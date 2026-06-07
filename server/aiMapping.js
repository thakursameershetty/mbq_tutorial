const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize the client securely using environment variables
// NEVER hardcode the API key here!
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Calls Gemini to attempt a smart match of a user against live Google Sheet records.
 * @param {string} fullName
 * @param {string} email
 * @param {string} phone
 * @param {Array<Object>} sheetRecords - Array of row objects keyed by sheet headers
 * @returns {{ matched: boolean, matched_survey_data: Object|null }}
 */
async function attemptSmartMapWithAI(fullName, email, phone, sheetRecords) {
  // gemini-2.0-flash: fast, cost-efficient, supports JSON mode
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

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
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        // Forces Gemini to output valid, parsable JSON every time
        responseMimeType: "application/json",
      },
    });

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    return {
      matched: parsedData.matched === true,
      matched_survey_data: parsedData.matched_survey_data || null,
    };
  } catch (error) {
    // Check if the error is an AI Studio Rate Limit (429)
    if (error.status === 429 || error.message.includes('429') || error.message.includes('quota')) {
      console.error("⚠️ Gemini API Rate Limit Hit!");
      return { 
        rate_limited: true, 
        matched: false, 
        matched_survey_data: null 
      };
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
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

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
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    });

    return JSON.parse(result.response.text());
  } catch (error) {
    console.error("AI Phenotypic Analysis Error:", error);
    return null;
  }
}

module.exports = {
  attemptSmartMapWithAI,
  generatePhenotypicAnalysis,
};
