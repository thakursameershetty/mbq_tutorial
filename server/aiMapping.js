// ─────────────────────────────────────────────────────────────────────────────
// Azure OpenAI Integration
// ─────────────────────────────────────────────────────────────────────────────

const AZURE_OPENAI_ENDPOINT = "https://qa-reaidy-open-ai.openai.azure.com";
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = "gpt-4";
const AZURE_OPENAI_API_VERSION = "2024-02-01";

// Request timeout: abort any single API call after this many ms
const API_TIMEOUT_MS = 20_000;

// ─────────────────────────────────────────────────────────────────────────────
// Google Sheet data cache (shared across requests)
// ─────────────────────────────────────────────────────────────────────────────
let _sheetCache = null;    // { data: [], expiresAt: timestamp }
const SHEET_CACHE_TTL_MS = 2 * 60_000;  // 2 minutes

function getCachedSheetData() {
  if (_sheetCache && Date.now() < _sheetCache.expiresAt) {
    console.log("📋 [Cache] Returning cached Google Sheet data.");
    return _sheetCache.data;
  }
  return null;
}

function setCachedSheetData(data) {
  _sheetCache = { data, expiresAt: Date.now() + SHEET_CACHE_TTL_MS };
  console.log(`📋 [Cache] Cached ${data.length} sheet row(s) for ${SHEET_CACHE_TTL_MS / 1000}s.`);
}

function invalidateSheetCache() {
  _sheetCache = null;
  console.log("📋 [Cache] Sheet cache invalidated.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Executor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executes a call to Azure OpenAI.
 *
 * @param {string} prompt The prompt to send to the model.
 * @param {boolean} requireJson Whether to force json_object response format.
 * @returns {Promise<any>} The parsed JSON response.
 */
async function executeAzureOpenAI(prompt, requireJson = true) {
  const url = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

  const payload = {
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2, // Low temperature for more deterministic JSON matching
  };

  if (requireJson) {
    payload.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_OPENAI_API_KEY
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const isRateLimit = response.status === 429;

      if (isRateLimit) {
        console.error(`⚠️ Azure OpenAI Rate Limited (429)`);
        throw { isRateLimit: true, message: "Rate limit exceeded" };
      }

      throw new Error(`Azure OpenAI API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const messageContent = data.choices[0]?.message?.content;

    if (!messageContent) {
      throw new Error("No content returned from Azure OpenAI");
    }

    return JSON.parse(messageContent);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Azure OpenAI request timed out after ${API_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart trim: keep only identity fields for the matching step
// ─────────────────────────────────────────────────────────────────────────────
function trimRowsForMatching(rows) {
  const IDENTITY_PATTERNS = [
    /name/i, /email/i, /phone/i, /mobile/i, /contact/i, /number/i,
  ];
  if (!rows || rows.length === 0) return rows;

  const allKeys = Object.keys(rows[0]);
  const relevantKeys = allKeys.filter(k =>
    IDENTITY_PATTERNS.some(p => p.test(k))
  );

  const keysToSend = relevantKeys.length >= 2 ? relevantKeys : allKeys.slice(0, 8);

  return rows.map(row => {
    const slim = {};
    keysToSend.forEach(k => { slim[k] = row[k]; });
    return slim;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: Smart match
// ─────────────────────────────────────────────────────────────────────────────

async function attemptSmartMapWithAI(fullName, email, phone, sheetRecords) {
  const slimRecords = trimRowsForMatching(sheetRecords);

  const prompt = `
    You are a data matching assistant for a healthcare application.
    Find the highest-probability match between a new user and a list of Tally survey records.

    New User:
    - Name: ${fullName}
    - Email: ${email}
    - Phone: ${phone}

    Survey Records (identity fields only):
    ${JSON.stringify(slimRecords, null, 2)}

    Rules:
    - Accept partial/reversed name matches, email domain mismatches, phone formatting differences.
    - Return the ORIGINAL INDEX (0-based) of the best match as "matched_index", or -1 if no confident match.
    - Confidence must be >= 70% to count as matched.

    You MUST return ONLY valid JSON matching this schema — no extra text:
    {
      "matched": true | false,
      "matched_index": <number> | -1,
      "confidence": <0-100>
    }
  `;

  try {
    const parsed = await executeAzureOpenAI(prompt, true);
    console.log(`🤖 Match result: matched=${parsed.matched}, confidence=${parsed.confidence}%, index=${parsed.matched_index}`);

    if (parsed.matched && parsed.matched_index >= 0 && parsed.matched_index < sheetRecords.length) {
      return {
        matched: true,
        matched_survey_data: sheetRecords[parsed.matched_index],
      };
    }

    return { matched: false, matched_survey_data: null };
  } catch (error) {
    if (error.isRateLimit) {
      return { rate_limited: true, matched: false, matched_survey_data: null };
    }
    console.error("Azure OpenAI Mapping Error:", error?.message || error);
    return { matched: false, matched_survey_data: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: Phenotypic analysis
// ─────────────────────────────────────────────────────────────────────────────

async function generatePhenotypicAnalysis(rawSurveyData) {
  const prompt = `
    You are an expert genetic and lifestyle data analyst.
    Analyze the following raw survey data:
    ${JSON.stringify(rawSurveyData, null, 2)}

    Convert answers into a highly structured JSON profile.
    Extract the exact meaning from the user's answers.

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
        "sensitivity": {
          "physicalSensitivity": "Extract physical sensitivity",
          "smallDoseSensitivity": "Extract small-dose sensitivity"
        },
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
    const parsed = await executeAzureOpenAI(prompt, true);
    return parsed;
  } catch (error) {
    console.error("Azure Phenotypic Analysis Error:", error?.message || error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic helpers
// ─────────────────────────────────────────────────────────────────────────────

function getKeyPoolStatus() {
  // Since we are using a single Azure OpenAI instance now, return a simpler status
  return [
    {
      label: "Azure OpenAI (gpt-4)",
      status: "available",
      cooldownSeconds: 0,
      failCount: 0
    }
  ];
}

function getSheetCacheStatus() {
  if (!_sheetCache) return { cached: false };
  const ttlLeft = Math.max(0, Math.ceil((_sheetCache.expiresAt - Date.now()) / 1000));
  return { cached: true, rows: _sheetCache.data.length, ttlSeconds: ttlLeft };
}

module.exports = {
  attemptSmartMapWithAI,
  generatePhenotypicAnalysis,
  getKeyPoolStatus,
  getSheetCacheStatus,
  getCachedSheetData,
  setCachedSheetData,
  invalidateSheetCache,
};
