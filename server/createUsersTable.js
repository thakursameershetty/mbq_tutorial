require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createTable() {
  try {
    console.log('Connecting to database...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        age INTEGER,
        dob DATE,
        gender VARCHAR(50),
        gene_type VARCHAR(255),
        phenotypic_analysis JSONB,
        survey_requested BOOLEAN DEFAULT FALSE,
        sample_collected BOOLEAN DEFAULT FALSE,
        sample_received BOOLEAN DEFAULT FALSE,
        report_uploaded BOOLEAN DEFAULT FALSE,
        report_generated BOOLEAN DEFAULT FALSE,
        report_verified BOOLEAN DEFAULT FALSE,
        report_url VARCHAR(555),
        reports JSONB DEFAULT '{}'::jsonb,
        report_answers JSONB DEFAULT '{}'::jsonb,
        status_timestamps JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ users table created successfully!');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    await pool.end();
  }
}

createTable();
