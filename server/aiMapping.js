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

/**
 * Executes a freeform chat call to Azure OpenAI (does not require JSON).
 *
 * @param {Array} messages Conversation history
 * @returns {Promise<string>} The AI's text response
 */
async function generateChatResponse(messages) {
  const url = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

  const systemPrompt = {
    role: "system",
    content: "You are 'My Body Qode AI', a helpful and friendly personal health companion. You answer questions concisely about genomic profiles, fitness, sleep, and nutrition. Be conversational and approachable. Do not format your response as JSON, just use plain text."
  };

  // If the frontend didn't pass a system prompt, we prepend ours
  const payloadMessages = messages[0]?.role === 'system' ? messages : [systemPrompt, ...messages];

  const payload = {
    messages: payloadMessages,
    temperature: 0.7,
  };

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
      console.error(`⚠️ Azure OpenAI Chat API Error (Status ${response.status})`, errorData);
      throw new Error(`Azure OpenAI Chat Error: ${response.status}`);
    }

    const data = await response.json();
    const messageContent = data.choices[0]?.message?.content;

    if (!messageContent) {
      throw new Error("No content returned from Azure OpenAI Chat");
    }

    return messageContent;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Azure OpenAI Chat request timed out after ${API_TIMEOUT_MS / 1000}s`);
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

  return rows.map((row, index) => {
    const slim = { row_index: index };
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
    - Return the exact "row_index" of the best match as "matched_index", or -1 if no confident match.
    - Confidence must be >= 70% to count as matched.

    You MUST return ONLY valid JSON matching this schema — no extra text:
    {
      "matched": true | false,
      "matched_index": <number from row_index> | -1,
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

async function generatePhenotypicAnalysis(rawSurveyData, userEmail, userPhone, testName, geneVariants) {
  const prompt = `
    You are an expert genetic and lifestyle data analyst.
    Analyze the following raw survey data:
    ${JSON.stringify(rawSurveyData, null, 2)}

    The user has selected the following specific test: "${testName}"
    And they have the following genetic variants for this test:
    ${JSON.stringify(geneVariants, null, 2)}

    Convert their answers into a highly structured JSON profile focused ONLY on this specific test.
    Extract the exact meaning from the user's answers and correlate it with what their specific gene variants mean.
    
    CRITICAL: The survey contains generic columns like "Any specific remarks" or "Please Mention here". These are now prepended with the question they belong to.
    If the user provided meaningful custom text in these remark columns for a topic, ALWAYS incorporate their custom text as the final answer instead of just returning the standard multiple-choice option. Do NOT output "No specific remarks provided" unless the field is genuinely empty.

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
      },
      "test_analysis": {
        "test_name": "${testName || 'General'}",
        "gene_variants_analyzed": "List the gene variants provided (if any)",
        "phenotypic_summary": "Summarize their physical answers to the questions",
        "genetic_correlation": "Explain how their specific gene variants correlate (or don't correlate) with their physical answers",
        "detailed_traits": {
           "trait_1": "Extract trait from answers",
           "trait_2": "Extract trait from answers"
        },
        "personalized_recommendations": [
           "Actionable advice 1 based on genes and answers",
           "Actionable advice 2 based on genes and answers"
        ]
      }
    }
  `;

  try {
    const parsed = await executeAzureOpenAI(prompt, true);

    // Forcefully override the email and mobile with the user's actual registered data
    if (parsed && parsed.personal_profile) {
      if (userEmail) parsed.personal_profile.email = userEmail;
      if (userPhone) parsed.personal_profile.mobile = userPhone;
    }

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

// ─────────────────────────────────────────────────────────────────────────────
// Public: Bulk Match
// ─────────────────────────────────────────────────────────────────────────────

async function attemptSmartBulkMatchWithAI(pastedText, users) {
  const rawNames = pastedText.split(/[\n\t,]+/).map(s => s.trim()).filter(Boolean);
  const locallyMatchedIds = new Set();
  const unmatchedNames = [];

  try {
    // 1. First attempt to do a local exact/partial match to save AI tokens and improve accuracy
    rawNames.forEach(rawName => {
      const lowerRaw = rawName.toLowerCase();
      // Try to find a user whose name exactly matches or matches without titles (Dr., Mr., etc)
      const match = users.find(u => {
        if (!u.full_name) return false;
        const lowerDbName = u.full_name.toLowerCase();
        return lowerDbName === lowerRaw ||
          lowerDbName.replace(/^(dr\.?|mr\.?|ms\.?|mrs\.?)\s+/i, '').trim() === lowerRaw.replace(/^(dr\.?|mr\.?|ms\.?|mrs\.?)\s+/i, '').trim();
      });

      if (match) {
        locallyMatchedIds.add(match.id);
      } else {
        unmatchedNames.push(rawName);
      }
    });

    console.log(`🤖 Bulk Match: Locally matched ${locallyMatchedIds.size} names. Sending ${unmatchedNames.length} names to AI.`);

    // If everything was matched locally, return immediately!
    if (unmatchedNames.length === 0) {
      return { matchedIds: Array.from(locallyMatchedIds), unmatchedNames: [] };
    }

    // 2. Prepare slim users array for AI (only send users that haven't been matched yet)
    const slimUsers = users
      .filter(u => !locallyMatchedIds.has(u.id))
      .map(u => ({
        id: u.id,
        n: u.full_name || '',
        e: u.email || '',
        p: u.phone || ''
      }));

    const BATCH_SIZE = 15;
    let aiMatchedIds = [];
    let aiUnmatchedNames = [];

    for (let i = 0; i < unmatchedNames.length; i += BATCH_SIZE) {
      const batchNames = unmatchedNames.slice(i, i + BATCH_SIZE);
      const prompt = `
        You are a data matching assistant for a healthcare application.
        The user provided a raw list of names that could not be matched perfectly via simple text comparison.
        
        Unmatched Raw Names:
        ${JSON.stringify(batchNames)}

        Here is the list of remaining users in our database (id, n=name, e=email, p=phone):
        ${JSON.stringify(slimUsers)}

        Your task is to match the people mentioned in the unmatched raw names to the remaining users in the database. 
        Account for typos, partial names, or format differences.
        
        Return ONLY a JSON object with two keys:
        "matched_ids": containing an array of integers representing the IDs of the matched users.
        "unmatched_names": containing an array of strings representing the raw names from the "Unmatched Raw Names" list that could NOT be matched to any database user.
        {
          "matched_ids": [1, 5, 23],
          "unmatched_names": ["John Doe", "Unknown Person"]
        }
      `;

      try {
        const parsed = await executeAzureOpenAI(prompt, true);
        if (parsed.matched_ids) aiMatchedIds.push(...parsed.matched_ids);
        if (parsed.unmatched_names) aiUnmatchedNames.push(...parsed.unmatched_names);
      } catch (err) {
        console.error("Error matching batch:", err);
        aiUnmatchedNames.push(...batchNames);
      }
    }

    console.log(`🤖 Bulk Match: AI found ${aiMatchedIds.length} matches and ${aiUnmatchedNames.length} unmatched.`);

    // Combine local matches with AI matches
    return {
      matchedIds: [...Array.from(locallyMatchedIds), ...aiMatchedIds],
      unmatchedNames: aiUnmatchedNames
    };
  } catch (error) {
    console.error("Azure OpenAI Bulk Match Error:", error?.message || error);
    if (error.response) {
      console.error("Response data:", await error.response.text().catch(() => ''));
    }
    // Even if AI fails, return whatever we managed to match locally, and all the unmatched names
    return {
      matchedIds: Array.from(locallyMatchedIds),
      unmatchedNames: unmatchedNames
    };
  }
}

module.exports = {
  attemptSmartMapWithAI,
  generatePhenotypicAnalysis,
  getKeyPoolStatus,
  getSheetCacheStatus,
  getCachedSheetData,
  setCachedSheetData,
  invalidateSheetCache,
  attemptSmartBulkMatchWithAI,
  generateChatResponse,
};
