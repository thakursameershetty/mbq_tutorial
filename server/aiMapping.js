const { GoogleGenerativeAI } = require("@google/generative-ai");

// ─────────────────────────────────────────────────────────────────────────────
// API Key Pool Setup
// ─────────────────────────────────────────────────────────────────────────────

// Collect all configured keys, filter out blank / undefined entries
const rawKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
].filter(Boolean);

if (rawKeys.length === 0) {
  console.error("CRITICAL: No GEMINI_API_KEY found in environment variables.");
}

console.log(`🔑 Gemini key pool initialised with ${rawKeys.length} key(s).`);

// Per-key health state
// Each entry: { key, cooldownUntil: timestamp | 0, failCount }
const keyPool = rawKeys.map((key, i) => ({
  key,
  label: `Key-${i + 1}`,          // human-readable label for logs
  cooldownUntil: 0,                // epoch ms — 0 means "available now"
  failCount: 0,                    // cumulative soft-failure counter
}));

// How long (ms) to cool a key down after a rate-limit hit
const RATE_LIMIT_COOLDOWN_MS  = 60_000;   // 1 minute for 429 / quota
const TRANSIENT_COOLDOWN_MS   = 15_000;   // 15 s for other transient errors
const MAX_FAIL_COUNT          = 5;        // after this many failures, cool for longer

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true when an error is a Gemini rate-limit / quota exhaustion */
function isRateLimitError(error) {
  return (
    error?.status === 429 ||
    error?.code === 429 ||
    String(error?.message).includes('429') ||
    String(error?.message).toLowerCase().includes('quota') ||
    String(error?.message).toLowerCase().includes('rate') ||
    String(error?.message).toLowerCase().includes('exhausted') ||
    String(error?.message).toLowerCase().includes('resource_exhausted')
  );
}

/** Returns true for transient infrastructure errors worth retrying on another key */
function isTransientError(error) {
  if (isRateLimitError(error)) return true;
  const status = error?.status || error?.code;
  if ([500, 502, 503, 504].includes(status)) return true;
  const msg = String(error?.message).toLowerCase();
  return (
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes('network') ||
    msg.includes('socket') ||
    msg.includes('unavailable') ||
    msg.includes('internal') ||
    msg.includes('overloaded')
  );
}

/**
 * Picks the next usable key from the pool.
 * Prefers the key with the earliest cooldownUntil that is already past.
 * Falls back to the key whose cooldown expires soonest.
 *
 * @param {number} excludeIndex  index to skip first (the one that just failed)
 * @returns {{ entry: object, index: number } | null}
 */
function pickNextKey(excludeIndex = -1) {
  const now = Date.now();

  // 1. Try to find a key that is available right now (not on cooldown)
  for (let i = 0; i < keyPool.length; i++) {
    if (i === excludeIndex) continue;
    if (keyPool[i].cooldownUntil <= now) return { entry: keyPool[i], index: i };
  }

  // 2. All keys are on cooldown — pick whichever recovers soonest (excluding failed one)
  let best = null;
  for (let i = 0; i < keyPool.length; i++) {
    if (i === excludeIndex) continue;
    if (!best || keyPool[i].cooldownUntil < keyPool[best.index].cooldownUntil) {
      best = { entry: keyPool[i], index: i };
    }
  }
  return best;
}

/** Put a key into cooldown after a failure */
function cooldownKey(index, isRateLimit) {
  const entry = keyPool[index];
  entry.failCount++;

  // Longer cooldown if the key has been hammered repeatedly
  const multiplier = entry.failCount >= MAX_FAIL_COUNT ? 3 : 1;
  const baseCooldown = isRateLimit ? RATE_LIMIT_COOLDOWN_MS : TRANSIENT_COOLDOWN_MS;
  entry.cooldownUntil = Date.now() + baseCooldown * multiplier;

  console.warn(
    `⏳ [${entry.label}] on cooldown for ${(baseCooldown * multiplier / 1000).toFixed(0)}s ` +
    `(failCount=${entry.failCount}, reason=${isRateLimit ? '429/quota' : 'transient'})`
  );
}

/** Reset a key's health state after a successful call */
function markKeyHealthy(index) {
  keyPool[index].failCount = Math.max(0, keyPool[index].failCount - 1); // gradual recovery
  keyPool[index].cooldownUntil = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Failover Executor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executes generateContentFn with automatic failover across the key pool.
 * On rate-limit or transient errors, rotates to the next healthy key.
 * Throws only when all keys have been exhausted.
 *
 * @param {(model: import("@google/generative-ai").GenerativeModel) => Promise<any>} generateContentFn
 */
async function executeWithFailover(generateContentFn) {
  // Start from a healthy key
  let chosen = pickNextKey(-1);
  if (!chosen) {
    throw new Error("No Gemini API keys are configured.");
  }

  const triedIndices = new Set();
  let lastError = null;

  while (chosen && !triedIndices.has(chosen.index)) {
    const { entry, index } = chosen;
    triedIndices.add(index);

    // If this key is still on cooldown, wait it out (only if it's the last option)
    const remaining = entry.cooldownUntil - Date.now();
    if (remaining > 0) {
      if (triedIndices.size === keyPool.length) {
        // All keys tried — surface the wait as a rate-limit error
        console.warn(`⚠️ All keys exhausted. Shortest cooldown: ${(remaining / 1000).toFixed(0)}s remaining.`);
        throw lastError || new Error("All Gemini API keys are rate-limited.");
      }
      // Skip this key for now, try another
      chosen = pickNextKey(index);
      continue;
    }

    console.log(`🔑 Using Gemini ${entry.label}...`);
    const genAI = new GoogleGenerativeAI(entry.key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    try {
      const result = await generateContentFn(model);
      markKeyHealthy(index);                      // reward success
      console.log(`✅ ${entry.label} succeeded.`);
      return result;
    } catch (error) {
      lastError = error;
      const rateLimit = isRateLimitError(error);
      const transient = isTransientError(error);

      console.warn(`⚠️ ${entry.label} failed — ${error?.status || '?'}: ${error?.message?.substring(0, 120)}`);

      if (transient) {
        cooldownKey(index, rateLimit);
        chosen = pickNextKey(index);              // rotate to the next key
      } else {
        // Non-transient error (bad request, auth error, etc.) — don't retry on other keys
        console.error(`❌ ${entry.label}: non-transient error, not retrying on other keys.`);
        throw error;
      }
    }
  }

  // All keys tried and all failed transiently
  throw lastError || new Error("All Gemini API keys failed.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls Gemini to attempt a smart match of a user against live Google Sheet records.
 * @param {string} fullName
 * @param {string} email
 * @param {string} phone
 * @param {Array<Object>} sheetRecords - Array of row objects keyed by sheet headers
 * @returns {{ matched: boolean, matched_survey_data: Object|null, rate_limited?: boolean }}
 */
async function attemptSmartMapWithAI(fullName, email, phone, sheetRecords) {

  const prompt = `
    You are a data matching assistant for a healthcare application.
    Your goal is to find the highest probability match between a new user and a list of Tally survey records from a Google Sheet.

    New User Registration Data:
    - Name: ${fullName}
    - Email: ${email}
    - Phone: ${phone}
    
    Unlinked Sheet Records:
    ${JSON.stringify(sheetRecords, null, 2)}
    
    Look for name similarities (including partial or reversed names), partial email matches, 
    or phone number formatting variations (ignore spaces, dashes, country codes).
    
    If you find a confident match, return the full matched row object exactly as it appears in the array.
    If you are not confident, return null for matched_survey_data.
    
    You MUST return ONLY a valid JSON object matching this exact schema with no extra text:
    {
      "matched": true | false,
      "matched_survey_data": { ...the full matched row object... } | null
    }
  `;

  try {
    const result = await executeWithFailover(async (model) => {
      return await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          // Forces Gemini to output valid, parsable JSON every time
          responseMimeType: "application/json",
        },
      });
    });

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    return {
      matched: parsedData.matched === true,
      matched_survey_data: parsedData.matched_survey_data || null,
    };
  } catch (error) {
    if (isRateLimitError(error) || String(error?.message).includes('All Gemini')) {
      console.error("⚠️ All Gemini API keys exhausted (Rate Limit)!");
      return { rate_limited: true, matched: false, matched_survey_data: null };
    }

    console.error("Gemini AI Mapping Error:", error);
    // Fail gracefully — registration will prompt the user to complete the survey
    return { matched: false, matched_survey_data: null };
  }
}

/**
 * Calls Gemini to transform raw survey row data into a structured phenotypic profile JSON.
 * @param {Object} rawSurveyData - The matched Google Sheet row object
 * @returns {Object|null} Structured phenotypic analysis JSON, or null on failure
 */
async function generatePhenotypicAnalysis(rawSurveyData) {

  const prompt = `
    You are an expert genetic and lifestyle data analyst.
    Analyze the following raw survey data provided by a user:
    ${JSON.stringify(rawSurveyData, null, 2)}

    Convert their answers into a highly structured JSON profile exactly matching the categories provided below.
    Extract the exact meaning from their answers.
    
    You MUST return ONLY a valid JSON object with this exact schema:
    {
      "personal_profile": {
        "age": "Extract age and range",
        "mobile": "Extract mobile number",
        "email": "Extract email",
        "dailyActivity": "Extract daily activity level",
        "sleepTiming": "Extract sleep timing"
      },
      "caffeine_response": {
        "sleepImpact": "Extract how caffeine impacts sleep",
        "durationOfEffect": "Extract duration of stimulant effect",
        "sensitivity": "Extract physical sensitivity and small-dose sensitivity",
        "tolerance": "Extract time-of-day tolerance"
      },
      "hair_scalp_characteristics": {
        "thickness": "Extract hair thickness",
        "texture": "Extract hair texture/shape",
        "scalpType": "Extract scalp oiliness/dryness",
        "sweating": "Extract sweating tendency",
        "stability": "Extract stability of traits over time"
      },
      "physical_performance": {
        "power": "Extract power and explosive response",
        "endurance": "Extract endurance capacity",
        "muscleAdaptation": "Extract muscle performance preference",
        "recovery": "Extract recovery speed",
        "trainingPreference": "Extract response to progressive training load"
      }
    }
  `;

  try {
    const result = await executeWithFailover(async (model) => {
      return await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      });
    });

    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("AI Phenotypic Analysis Error:", error?.message || error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic helper — exposes current key health (useful for debugging)
// ─────────────────────────────────────────────────────────────────────────────
function getKeyPoolStatus() {
  const now = Date.now();
  return keyPool.map(({ label, cooldownUntil, failCount }) => ({
    label,
    status: cooldownUntil > now ? `cooling (${((cooldownUntil - now) / 1000).toFixed(0)}s)` : 'available',
    failCount,
  }));
}

module.exports = {
  attemptSmartMapWithAI,
  generatePhenotypicAnalysis,
  getKeyPoolStatus,
};
