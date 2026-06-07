require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function resetData() {
  try {
    console.log('Connecting to database...');

    await pool.query('BEGIN');

    // 1. Unlink all surveys so they are available for the AI to match again
    await pool.query('UPDATE survey_data SET user_id = NULL;');
    console.log('✅ All surveys successfully unlinked.');

    // 2. Clear all users and reset the auto-incrementing ID counter back to 1
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');
    console.log('✅ Users table wiped clean and IDs reset.');

    await pool.query('COMMIT');
    console.log('🎉 Database reset complete! Ready for fresh testing.');

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error resetting database:', error);
  } finally {
    await pool.end();
  }
}

resetData();
