require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  const username = "testuser999";
  const fullName = "Test User";
  const email = "testuser999@example.com";
  const phone = "91 9999999999";
  const age = null; // Maybe age is null?
  const dob = "1990-01-01";
  const gender = "Male";
  const geneType = "MTHFR";

  try {
    const insertUserQuery = `
      INSERT INTO users (username, full_name, email, phone, age, dob, gender, gene_type, phenotypic_analysis, survey_requested, status_timestamps)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id;
    `;
    const initialTimestamps = JSON.stringify({
      registered: new Date().toISOString()
    });

    const userResult = await pool.query(insertUserQuery, [
      username, fullName, email, phone, age, dob, gender, geneType,
      null,
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
