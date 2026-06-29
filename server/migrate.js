require('dotenv').config({ path: 'server/.env' });
const { Pool } = require('pg');

async function runMigration() {
  let pool;
  
  // Try with SSL first
  try {
    console.log('Attempting connection with SSL...');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await pool.query('SELECT 1');
    console.log('SSL connection verified.');
  } catch (err) {
    if (err.message.includes('SSL') || err.message.includes('support SSL')) {
      console.log('SSL connection failed. Falling back to non-SSL connection...');
      pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });
    } else {
      throw err;
    }
  }

  try {
    console.log('Running migration...');
    
    // Add columns if they do not exist
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS sample_received BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS report_uploaded BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS report_generated BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS report_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS report_url VARCHAR(555),
      ADD COLUMN IF NOT EXISTS reports JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS status_timestamps JSONB DEFAULT '{}'::jsonb;
    `);
    
    console.log('✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    if (pool) await pool.end();
  }
}

runMigration().catch(console.error);
