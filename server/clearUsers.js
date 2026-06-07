require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function clearUsers() {
  try {
    console.log("Connecting to the database...");

    // DELETE FROM users removes all rows but keeps the table structure intact
    const result = await pool.query('DELETE FROM users');

    console.log(`✅ Successfully deleted ${result.rowCount} user(s) from the database.`);
  } catch (error) {
    console.error("❌ Error clearing users table:", error);
  } finally {
    await pool.end();
  }
}

clearUsers();
