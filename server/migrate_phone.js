require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;');
    console.log('Successfully added phone_verified column.');
  } catch (err) {
    if (err.code === '42701') {
      console.log('Column phone_verified already exists.');
    } else {
      console.error('Migration failed:', err);
    }
  } finally {
    pool.end();
  }
}
migrate();
