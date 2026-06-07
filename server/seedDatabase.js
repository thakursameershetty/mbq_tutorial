require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log('1. Resetting database table to include RAW DATA storage...');

    await client.query(`
      DROP TABLE IF EXISTS survey_data CASCADE;
      CREATE TABLE survey_data (
        id SERIAL PRIMARY KEY,
        user_id INT, 
        survey_email VARCHAR(255),
        survey_phone VARCHAR(50),
        lifestyle_data JSONB,
        caffeine_data JSONB,
        physical_data JSONB,
        fitness_data JSONB,
        full_raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table ready.');

    console.log('2. Reading survey.csv and importing ALL data...');
    const results = [];

    fs.createReadStream('survey.csv')
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let insertedCount = 0;

        for (const row of results) {
          // Keep the clean mapped data for your UI Dashboard
          const lifestyle = {
            activity: row['6. Typical Daily Activity Level'],
            sleep: row['7. Sleep Timing (Most days)']
          };
          const caffeine = {
            impact: row['1. Sleep impact of caffeine'],
            duration: row['2. Duration of stimulant effect'],
            sensitivity: row['5. Small-dose sensitivity']
          };
          const physical = {
            hairTexture: row['2. Hair texture and shape'],
            sweat: row['4. Sweating tendency']
          };
          const fitness = {
            endurance: row['2. Endurance capacity'],
            recovery: row['4. Recovery speed']
          };

          const email = row['3. Email (Optional)'] || null;
          const phone = row['2. Mobile Number (WhatsApp preferred)'] || null;

          if (email || phone) {
            await client.query(
              `INSERT INTO survey_data 
              (survey_email, survey_phone, lifestyle_data, caffeine_data, physical_data, fitness_data, full_raw_data) 
              VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              // We pass the entire 'row' object to Postgres, which automatically saves all 80+ columns as JSON!
              [email, phone, lifestyle, caffeine, physical, fitness, row]
            );
            insertedCount++;
          }
        }

        console.log(`✅ Success: Inserted ${insertedCount} records, with 100% of the raw data preserved!`);
        client.release();
        process.exit(0);
      });

  } catch (error) {
    console.error('Error seeding database:', error);
    client.release();
    process.exit(1);
  }
}

seedDatabase();
