require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const { fetchGoogleSheetData } = require('./tallySync');
const { attemptSmartMapWithAI, generatePhenotypicAnalysis } = require('./aiMapping');

async function test() {
  const username = "testuser999";
  const fullName = "Test User";
  const email = "testuser999@example.com";
  const phone = "91 9999999999";
  const age = 30;
  const dob = "1990-01-01";
  const gender = "Male";
  const geneType = "MTHFR";

  try {
    let sheetData = await fetchGoogleSheetData();
    console.log("Sheet data fetched:", sheetData.length);
    
    const matchResult = await attemptSmartMapWithAI(fullName, email, phone, sheetData);
    console.log("Match result:", matchResult.matched);

    let analysisJSON = null;
    if (matchResult.matched && matchResult.matched_survey_data) {
      analysisJSON = await generatePhenotypicAnalysis(matchResult.matched_survey_data, email, phone);
      console.log("Analysis:", analysisJSON ? "Generated" : "Failed");
    }

    const initialTimestamps = JSON.stringify({
      registered: new Date().toISOString()
    });

    const insertUserQuery = `
      INSERT INTO users (username, full_name, email, phone, age, dob, gender, gene_type, phenotypic_analysis, survey_requested, status_timestamps)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id;
    `;
    const userResult = await pool.query(insertUserQuery, [
      username, fullName, email, phone, age, dob, gender, geneType,
      analysisJSON ? JSON.stringify(analysisJSON) : null,
      false,
      initialTimestamps
    ]);
    console.log("User inserted:", userResult.rows[0].id);
  } catch (error) {
    console.error("Caught Error:", error);
  } finally {
    await pool.end();
  }
}
test();
