require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  try {
    console.log('Connecting to database for migration...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS survey_requested BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Added survey_requested column to users table successfully!');
  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    await pool.end();
  }
}

migrate();
