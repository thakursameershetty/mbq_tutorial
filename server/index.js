require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { google } = require('googleapis');
const { attemptSmartMapWithAI, generatePhenotypicAnalysis } = require('./aiMapping');

const app = express();
const port = process.env.PORT || 5001;

// Middleware - Explicitly trust the Vite frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Database connection pool setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Fetches all rows from the configured Google Sheet and returns them as
 * an array of objects keyed by the first-row headers.
 * Requires: server/credentials.json (Service Account key) and GOOGLE_SHEET_ID in .env
 */
async function fetchGoogleSheetData() {
  let auth;

  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      // Vercel Production Environment
      // Vercel Production Environment
      const formattedCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

      auth = new google.auth.GoogleAuth({
        credentials: formattedCredentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } catch (err) {
      console.error('Error parsing GOOGLE_CREDENTIALS environment variable:', err);
      throw new Error('Failed to parse GOOGLE_CREDENTIALS');
    }
  } else {
    // Local Development Environment (looks for credentials.json in your server folder)
    auth = new google.auth.GoogleAuth({
      keyFile: 'credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const range = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A:BZ';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      console.warn('⚠️ Google Sheet returned no data rows.');
      return [];
    }

    // Row 0 = headers, rows 1..n = data — convert to array of objects
    const headers = rows[0];
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] ?? '';
      });
      return obj;
    });
  } catch (sheetError) {
    console.error('❌ Google Sheets API Error:', sheetError.message);
    throw sheetError;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration Route — Google Sheets as source of truth, Gemini as ETL layer
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { username, fullName, email, phone, age, gender, geneType } = req.body;

  try {
    // 1. Fetch live Tally.so data from the connected Google Sheet
    console.log('📊 Fetching live data from Google Sheet...');
    let sheetData;
    try {
      sheetData = await fetchGoogleSheetData();
    } catch (sheetError) {
      return res.status(500).json({
        error: 'Failed to communicate with Google Sheets configuration.',
        details: sheetError.message
      });
    }
    console.log(`   → ${sheetData.length} row(s) found in sheet.`);

    // 2. Ask Gemini to find this user in the sheet rows
    console.log('🤖 Running Gemini smart match...');
    const matchResult = await attemptSmartMapWithAI(fullName, email, phone, sheetData);

    // If the API minute or daily limit was hit, inform the frontend gently
    if (matchResult.rate_limited) {
      return res.status(429).json({
        success: false,
        message: "Our AI systems are currently very busy analyzing profiles. Please wait a minute and try again!"
      });
    }

    // 3. If no match found, halt registration and prompt the frontend to show the survey
    if (!matchResult.matched || !matchResult.matched_survey_data) {
      console.log('❌ Gemini could not confidently match this user to any sheet row.');
      return res.status(200).json({
        success: false,
        requiresSurvey: true,
        message: 'User not found in Tally records. Please complete the intake survey first.',
      });
    }

    console.log('✅ Match found! Running phenotypic analysis...');

    // 4. Transform the matched sheet row into a structured phenotypic profile
    const analysisJSON = await generatePhenotypicAnalysis(matchResult.matched_survey_data);

    // 5. Save the verified user and their phenotypic analysis in a single transaction
    await pool.query('BEGIN');

    const insertUserQuery = `
      INSERT INTO users (username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id;
    `;
    const userResult = await pool.query(insertUserQuery, [
      username, fullName, email, phone, age, gender, geneType,
      analysisJSON ? JSON.stringify(analysisJSON) : null,
    ]);

    await pool.query('COMMIT');

    const newUserId = userResult.rows[0].id;
    console.log(`🧬 User #${newUserId} registered and phenotypic analysis saved.`);

    res.status(201).json({
      success: true,
      message: 'Profile created and synced with Tally.so data successfully.',
      userId: newUserId,
      profileLinked: true,
    });

  } catch (error) {
    await pool.query('ROLLBACK').catch(() => { }); // safe rollback — may not have started
    console.error('Registration Error:', error);
    
    // 23505 is the PostgreSQL error code for unique violation
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'This email or username is already registered. Please login instead.'
      });
    }

    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Login Route
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) {
    return res.status(400).json({ error: 'Username and Email are required' });
  }

  try {
    const query = `
      SELECT 
        id, username, full_name, email, phone, gene_type, phenotypic_analysis
      FROM users
      WHERE LOWER(email) = LOWER($1) AND username = $2
    `;
    const result = await pool.query(query, [email.trim(), username.trim()]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invalid username or email.' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Update User Details Route
// ─────────────────────────────────────────────────────────────────────────────
app.put('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { full_name, email, phone, age, phenotypic_analysis } = req.body;

  try {
    const query = `
      UPDATE users 
      SET full_name = $1, email = $2, phone = $3, age = $4, phenotypic_analysis = $5
      WHERE id = $6
      RETURNING id, username, full_name, email, phone, gene_type, phenotypic_analysis;
    `;
    const result = await pool.query(query, [full_name, email, phone, age, JSON.stringify(phenotypic_analysis), userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET Route for Admin Dashboard
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/admin/patients', async (req, res) => {
  try {
    const query = `
      SELECT 
        id, username, full_name, email, phone, gene_type, phenotypic_analysis
      FROM users
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Start the server (only locally, not on Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running locally on port ${port}`);
  });
}

// Crucial for Vercel serverless integration
module.exports = app;
