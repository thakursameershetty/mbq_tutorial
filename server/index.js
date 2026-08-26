require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { google } = require('googleapis');
const { attemptSmartMapWithAI, generatePhenotypicAnalysis, getKeyPoolStatus, getSheetCacheStatus, getCachedSheetData, setCachedSheetData, invalidateSheetCache, attemptSmartBulkMatchWithAI, generateChatResponse } = require('./aiMapping');
const { sendSampleDispatchedEmail, sendForgotCredentialsEmail, sendOtpEmail, sendReportReadyEmail, sendCollectAnswersEmail } = require('./mailer');
const { sendWhatsAppSampleDispatched, sendWhatsAppReportGenerated, sendWhatsAppReportReady, sendWhatsAppSurveyRequested } = require('./whatsapp');
const { QUESTION_ID_MAP } = require('./questionMapper');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const port = process.env.PORT || 5001;

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mbq_reports',
    format: async (req, file) => 'pdf',
    public_id: (req, file) => `report-${Date.now()}-${Math.round(Math.random() * 1E9)}`,
  },
});
const upload = multer({ storage: storage });

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

// Avoid node process crashing on unexpected PG connection error on idle clients
pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});

// Ensure the per-page report feedback table (and its emoji column, added after the
// table was first created by server/createFeedbackTable.js) exists on startup.
pool.query(`
  CREATE TABLE IF NOT EXISTS report_feedback (
    id SERIAL PRIMARY KEY,
    test_name VARCHAR(255),
    page_index INTEGER,
    feedback TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE report_feedback ADD COLUMN IF NOT EXISTS emoji VARCHAR(20);
  ALTER TABLE report_feedback ADD COLUMN IF NOT EXISTS mbq_id VARCHAR(50);
  CREATE UNIQUE INDEX IF NOT EXISTS report_feedback_unique_page ON report_feedback (mbq_id, test_name, page_index);
`).catch(err => console.error('Failed to ensure report_feedback table:', err));

// Tracks which upcoming tests a user is interested in, surfaced during the report
// download countdown.
pool.query(`
  CREATE TABLE IF NOT EXISTS test_interests (
    id SERIAL PRIMARY KEY,
    mbq_id VARCHAR(50) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    interested BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS test_interests_unique ON test_interests (mbq_id, test_name);
`).catch(err => console.error('Failed to ensure test_interests table:', err));

// QODAi chatbot state, keyed by user_id so it syncs across every device a user
// logs in on instead of living in a single browser's localStorage.
pool.query(`
  CREATE TABLE IF NOT EXISTS chat_sessions (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, session_id)
  );
  CREATE TABLE IF NOT EXISTS chat_usage (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    prompt_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error('Failed to ensure chat_sessions/chat_usage tables:', err));

/**
 * Fetches all rows from the configured Google Sheet.
 * Results are cached for SHEET_CACHE_TTL_MS (2 min) to reduce Sheets API load.
 * @param {boolean} force - If true, bypasses and clears the cache.
 */
async function fetchGoogleSheetData(force = false) {
  if (force) invalidateSheetCache();

  // Return cached data if still fresh
  const cached = getCachedSheetData();
  if (cached) return cached;

  let auth;

  if (process.env.GOOGLE_CREDENTIALS) {
    try {
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
      console.warn('\u26a0\ufe0f Google Sheet returned no data rows.');
      return [];
    }

    // Row 0 = headers, rows 1..n = data — convert to array of objects
    const headers = rows[0];
    const uniqueHeaders = [];
    const headerCounts = {};
    let lastMainQuestion = "General";

    headers.forEach(header => {
      let trimmed = (header || `Column`).trim();

      // If the column is generic, attach the context of the last main question to it
      if (/^(Any specific remarks|Please Mention here)$/i.test(trimmed) || trimmed === "") {
        trimmed = `${lastMainQuestion} - ${trimmed || 'Remarks'}`;
      } else {
        lastMainQuestion = trimmed;
      }

      // Deduplicate column names so JSON keys aren't overwritten
      if (headerCounts[trimmed] !== undefined) {
        headerCounts[trimmed]++;
        uniqueHeaders.push(`${trimmed} (${headerCounts[trimmed]})`);
      } else {
        headerCounts[trimmed] = 0;
        uniqueHeaders.push(trimmed);
      }
    });

    const data = rows.slice(1).map(row => {
      const obj = {};
      uniqueHeaders.forEach((header, index) => {
        obj[header] = row[index] ?? '';
      });
      return obj;
    });

    // Store in cache before returning
    setCachedSheetData(data);
    return data;
  } catch (sheetError) {
    console.error('\u274c Google Sheets API Error:', sheetError.message);
    throw sheetError;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Key Pool Health Check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/gemini-status', (_req, res) => {
  res.json({
    keys: getKeyPoolStatus(),
    sheetCache: getSheetCacheStatus(),
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Registration Route — Google Sheets as source of truth, Gemini as ETL layer
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/auth/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const result = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    res.json({ exists: result.rows.length > 0 });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    res.json({ exists: result.rows.length > 0 });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/check-phone', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: 'Phone is required' });
    }
    const result = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    res.json({ exists: result.rows.length > 0 });
  } catch (error) {
    console.error('Error checking phone:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Generate a random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Upsert the OTP into the database
    await pool.query(
      `INSERT INTO otps (email, otp, created_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (email)
       DO UPDATE SET otp = EXCLUDED.otp, created_at = CURRENT_TIMESTAMP;`,
      [email, otp]
    );

    // Send the email
    await sendOtpEmail(email, otp);

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    const otpResult = await pool.query(
      "SELECT * FROM otps WHERE email = $1 AND otp = $2 AND created_at > NOW() - INTERVAL '10 minutes'",
      [email, otp]
    );

    if (otpResult.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

app.post('/api/auth/recover-credentials', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Identifier is required' });
    }

    // Check if the identifier is an email or phone number
    const isEmail = identifier.includes('@');
    let query;
    if (isEmail) {
      query = 'SELECT username, email, phone FROM users WHERE email = $1';
    } else {
      query = 'SELECT username, email, phone FROM users WHERE phone = $1';
    }

    const result = await pool.query(query, [identifier]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      // Send the beautifully formatted email using Resend
      await sendForgotCredentialsEmail(user);

      res.json({ success: true, message: 'Credentials sent successfully.' });
    } else {
      res.status(404).json({ error: 'No account found with that information.' });
    }
  } catch (error) {
    console.error('Error recovering credentials:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, fullName, email, phone, age, dob, gender, geneType, otp } = req.body;

  if (!otp) {
    return res.status(400).json({ error: 'OTP is required' });
  }

  if (dob) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dob)) {
      return res.status(400).json({ error: 'Invalid date of birth format, expected YYYY-MM-DD' });
    }
    const [y, m, d] = dob.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (dateObj.getFullYear() !== y || dateObj.getMonth() !== m - 1 || dateObj.getDate() !== d) {
      return res.status(400).json({ error: 'Invalid date of birth' });
    }
  }

  try {
    // Verify OTP first
    const otpResult = await pool.query(
      "SELECT * FROM otps WHERE email = $1 AND otp = $2 AND created_at > NOW() - INTERVAL '10 minutes'",
      [email, otp]
    );

    if (otpResult.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // OTP is valid, delete it so it can't be reused
    await pool.query('DELETE FROM otps WHERE email = $1', [email]);

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

    // 3. If no match found, continue registration with null phenotypic data
    let analysisJSON = null;
    if (!matchResult.matched || !matchResult.matched_survey_data) {
      console.log('❌ Gemini could not confidently match this user to any sheet row. Registering without phenotypic data.');
    } else {
      console.log('✅ Match found! Running phenotypic analysis...');
      // 4. Transform the matched sheet row into a structured phenotypic profile
      analysisJSON = await generatePhenotypicAnalysis(matchResult.matched_survey_data, email, phone);
    }

    // 5. Save the verified user and their phenotypic analysis in a single transaction
    await pool.query('BEGIN');

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
        message: 'This username or phone number is already registered. Please login instead.'
      });
    }

    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Login Route
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    // Verify OTP first
    const otpResult = await pool.query(
      "SELECT * FROM otps WHERE email = $1 AND otp = $2 AND created_at > NOW() - INTERVAL '10 minutes'",
      [email, otp]
    );

    if (otpResult.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // OTP is valid, delete it
    await pool.query('DELETE FROM otps WHERE email = $1', [email]);

    const query = `
      SELECT 
        id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, 
        sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
    `;
    const result = await pool.query(query, [email.trim()]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invalid username or email.' });
    }

    if (result.rowCount === 1) {
      res.json({
        success: true,
        user: result.rows[0]
      });
    } else {
      res.json({
        success: true,
        users: result.rows
      });
    }
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
      RETURNING id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, 
                sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at;
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
// Update User Gene Type Route
// ─────────────────────────────────────────────────────────────────────────────
app.put('/api/users/:id/gene', async (req, res) => {
  const userId = req.params.id;
  const { gene_type } = req.body;

  try {
    const query = `
      UPDATE users 
      SET gene_type = $1
      WHERE id = $2
      RETURNING id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, 
                sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at;
    `;
    const result = await pool.query(query, [gene_type, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update Gene Type Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET Route for Admin Dashboard
// ─────────────────────────────────────────────────────────────────────────────
// Get Specific User Route
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const query = `
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, 
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at
      FROM users WHERE id = $1
    `;
    const result = await pool.query(query, [userId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user data.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Get Users by Email Route (For Switch Accounts)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/users/by-email/:email', async (req, res) => {
  const email = req.params.email;
  try {
    const query = `
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, 
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at
      FROM users WHERE LOWER(email) = LOWER($1)
      ORDER BY id ASC
    `;
    const result = await pool.query(query, [email]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users by email:', err);
    res.status(500).json({ error: 'Failed to fetch users by email.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/admin/patients', async (req, res) => {
  try {
    const query = `
      SELECT 
        id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, 
        sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at
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

// ─────────────────────────────────────────────────────────────────────────────
// Smart Bulk Match API
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/admin/smart-bulk-match', async (req, res) => {
  const { pastedText } = req.body;
  if (!pastedText) {
    return res.status(400).json({ error: 'pastedText is required' });
  }

  try {
    const query = `
      SELECT id, full_name, email, phone, username, sample_received
      FROM users;
    `;
    const result = await pool.query(query);
    const users = result.rows;

    const matchResult = await attemptSmartBulkMatchWithAI(pastedText, users);

    // Support both old array return and new object return
    const matchedIds = Array.isArray(matchResult) ? matchResult : matchResult.matchedIds;
    const unmatchedNames = Array.isArray(matchResult) ? [] : matchResult.unmatchedNames;

    // Return full objects for the matched users so the frontend can display them
    const matchedUsers = users
      .filter(u => matchedIds.includes(u.id))
      .map(u => ({
        id: u.id,
        full_name: u.full_name,
        username: u.username,
        sample_received: u.sample_received
      }));

    res.json({ success: true, matched_users: matchedUsers, matched_ids: matchedIds, unmatched_names: unmatchedNames });
  } catch (error) {
    console.error('Error in smart bulk match:', error);
    res.status(500).json({ error: 'Failed to perform smart bulk match' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Questions API
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/admin/questions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM test_questions ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

app.put('/api/admin/questions/:id', async (req, res) => {
  const { id } = req.params;
  const { subgene1_questions, subgene2_questions } = req.body;
  try {
    const query = `
      UPDATE test_questions
      SET subgene1_questions = $1, subgene2_questions = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const result = await pool.query(query, [
      JSON.stringify(subgene1_questions),
      JSON.stringify(subgene2_questions),
      id
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Questions not found.' });
    }
    res.json({ success: true, questions: result.rows[0] });
  } catch (error) {
    console.error('Error updating questions:', error);
    res.status(500).json({ error: 'Failed to update questions' });
  }
});

// Helper function to update status timestamps in PG
async function updateStatusTimestamp(userId, statusName, isTrue) {
  const selectQuery = `SELECT status_timestamps FROM users WHERE id = $1`;
  const selectResult = await pool.query(selectQuery, [userId]);
  if (selectResult.rowCount > 0) {
    let ts = selectResult.rows[0].status_timestamps || {};
    if (typeof ts === 'string') {
      ts = JSON.parse(ts);
    }
    if (isTrue) {
      ts[statusName] = new Date().toISOString();
    } else {
      delete ts[statusName];
    }
    const updateQuery = `UPDATE users SET status_timestamps = $1 WHERE id = $2`;
    await pool.query(updateQuery, [JSON.stringify(ts), userId]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update Sample Collected Status Route
// ─────────────────────────────────────────────────────────────────────────────
app.put('/api/users/:id/sample-collected', async (req, res) => {
  const userId = req.params.id;
  const { sampleCollected } = req.body;

  try {
    const query = `
      UPDATE users 
      SET sample_collected = $1
      WHERE id = $2
      RETURNING id, sample_collected, status_timestamps;
    `;
    const result = await pool.query(query, [sampleCollected, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await updateStatusTimestamp(userId, 'collected', sampleCollected);

    // Fetch updated user
    const updatedUserRes = await pool.query(`
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, 
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at
      FROM users WHERE id = $1
    `, [userId]);

    const updatedUser = updatedUserRes.rows[0];

    // Send email if marked as dispatched (collected)
    if (sampleCollected) {
      // Vercel Serverless requires awaiting async tasks before returning the response
      await sendSampleDispatchedEmail(updatedUser);
    }

    res.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error('Update Sample Collected Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Update Sample Received Status Route
// ─────────────────────────────────────────────────────────────────────────────
app.put('/api/users/:id/sample-received', async (req, res) => {
  const userId = req.params.id;
  const { sampleReceived, sendWhatsApp } = req.body;

  try {
    const query = `
      UPDATE users 
      SET sample_received = $1
      WHERE id = $2
      RETURNING id, sample_received;
    `;
    const result = await pool.query(query, [sampleReceived, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await updateStatusTimestamp(userId, 'received', sampleReceived);

    // Fetch updated user
    const updatedUserRes = await pool.query(`
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, 
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at
      FROM users WHERE id = $1
    `, [userId]);

    const updatedUser = updatedUserRes.rows[0];

    // Trigger WhatsApp if requested
    if (sendWhatsApp) {
      // Background async call
      sendWhatsAppSampleDispatched(updatedUser).catch(e => console.error("Auto WhatsApp Error:", e));
    }

    res.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error('Update Sample Received Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Request AI Report Generation (Automated Pipeline)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/users/:id/request-generation', async (req, res) => {
  const userId = req.params.id;
  const { panels } = req.body; // [{ geneName, variants }, ...]

  if (!Array.isArray(panels) || panels.length === 0) {
    return res.status(400).json({ error: 'panels array is required.' });
  }

  try {
    const userRes = await pool.query('SELECT reports, report_answers FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let reports = userRes.rows[0].reports || {};
    const testNames = [];

    for (const { geneName, variants } of panels) {
      if (!reports[geneName]) {
        reports[geneName] = {};
      }

      // Save variants inside the reports JSON for the specific gene
      reports[geneName].variants = variants;

      // Reset AI report since we are requesting a new one
      delete reports[geneName].ai_report;

      testNames.push(geneName);
    }

    // Update user to set survey_requested to true
    const updateQuery = `
      UPDATE users
      SET reports = $1, survey_requested = TRUE
      WHERE id = $2
      RETURNING *
    `;
    const updateRes = await pool.query(updateQuery, [reports, userId]);
    const updatedUser = updateRes.rows[0];

    // Trigger a single combined notification for every panel submitted in this batch
    sendCollectAnswersEmail(updatedUser, testNames);
    sendWhatsAppSurveyRequested(updatedUser, testNames);

    res.json({
      success: true,
      message: 'AI Report generation requested successfully.',
      user: updatedUser
    });
  } catch (error) {
    console.error('Request Generation Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Upload Genomic Report Endpoint (handles single PDF file)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/users/:id/upload-report', upload.single('report'), async (req, res) => {
  const userId = req.params.id;
  if (!req.file) {
    return res.status(400).json({ error: 'No report file uploaded.' });
  }

  const reportUrl = req.file.path; // Cloudinary returns the full secure URL in path
  const genotypes = req.body.genotypes ? JSON.parse(req.body.genotypes) : null;
  const geneName = req.body.geneName;
  const sendWhatsApp = req.body.sendWhatsApp === 'true';

  try {
    const userRes = await pool.query('SELECT reports, genotypes, phenotypic_analysis FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let currentReports = userRes.rows[0].reports || {};
    if (typeof currentReports === 'string') {
      currentReports = JSON.parse(currentReports);
    }

    let currentGenotypes = userRes.rows[0].genotypes || {};
    if (typeof currentGenotypes === 'string') {
      currentGenotypes = JSON.parse(currentGenotypes);
    }

    // Merge new genotypes with existing ones
    if (genotypes) {
      currentGenotypes = { ...currentGenotypes, ...genotypes };
    }

    if (geneName) {
      currentReports[geneName] = { url: reportUrl, uploadedAt: new Date().toISOString() };
    }

    const query = `
      UPDATE users 
      SET report_uploaded = TRUE, report_url = $1, genotypes = $2, reports = $4
      WHERE id = $3
      RETURNING id, report_uploaded, report_url, reports;
    `;
    const result = await pool.query(query, [reportUrl, JSON.stringify(currentGenotypes), userId, JSON.stringify(currentReports)]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await updateStatusTimestamp(userId, 'uploaded', true);

    // Use report_answers instead of phenotypic_analysis for the Python backend
    let phenotypeData = userRes.rows[0].report_answers || {};
    if (typeof phenotypeData === 'string') {
      phenotypeData = JSON.parse(phenotypeData);
    }

    // Fallback to phenotypic_analysis if report_answers is empty
    if (Object.keys(phenotypeData).length === 0) {
      phenotypeData = userRes.rows[0].phenotypic_analysis || {};
    }

    const flatResponses = {};
    const flatten = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          flatten(value, `${prefix}${key}_`);
        } else {
          flatResponses[`${prefix}${key}`] = value;
        }
      }
    };
    flatten(phenotypeData);

    const genotypeData = genotypes && geneName ? { genotype: genotypes[geneName] } : {};

    try {
      const pythonRes = await fetch(process.env.PYTHON_BACKEND_URL ? `${process.env.PYTHON_BACKEND_URL}/analyze-genomic` : 'http://localhost:8080/analyze-genomic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gene: geneName,
          genotype_data: genotypeData,
          phenotype_data: {
            gene: geneName,
            responses: flatResponses
          },
          lifestyle_context: {
            user_type: "explorer"
          }
        })
      });

      if (!pythonRes.ok) {
        const errText = await pythonRes.text();
        console.error('Python backend error:', errText);
        // Continue anyway to store the uploaded report
      } else {
        const pythonData = await pythonRes.json();
        // Save the generated report
        currentReports[geneName] = {
          ...currentReports[geneName],
          ai_report: pythonData.result,
          generated_at: new Date().toISOString()
        };

        // Update DB with the ai_report
        await pool.query(`
          UPDATE users 
          SET reports = $1, report_generated = TRUE
          WHERE id = $2
        `, [JSON.stringify(currentReports), userId]);

        await updateStatusTimestamp(userId, 'generated', true);
      }
    } catch (pyErr) {
      console.error('Failed to communicate with python backend:', pyErr);
    }

    // Fetch updated user
    const updatedUserRes = await pool.query(`
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, 
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at
      FROM users WHERE id = $1
    `, [userId]);

    const updatedUser = updatedUserRes.rows[0];

    if (sendWhatsApp) {
      sendWhatsAppReportReady(updatedUser).catch(e => console.error("Auto WhatsApp Error:", e));
    }

    res.json({
      success: true,
      message: 'Report uploaded and generated successfully.',
      user: updatedUser
    });
  } catch (error) {
    console.error('Upload Report Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete Genomic Report Endpoint
// ─────────────────────────────────────────────────────────────────────────────
app.delete('/api/users/:id/delete-report', async (req, res) => {
  const userId = req.params.id;
  const geneName = req.query.geneName;

  try {
    if (geneName) {
      const query = `
        UPDATE users 
        SET reports = reports - $2
        WHERE id = $1
        RETURNING reports;
      `;
      const result = await pool.query(query, [userId, geneName]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const updatedReports = result.rows[0].reports;
      if (!updatedReports || Object.keys(updatedReports).length === 0) {
        await pool.query(`UPDATE users SET report_uploaded = FALSE, report_url = NULL, report_generated = FALSE WHERE id = $1`, [userId]);
        await updateStatusTimestamp(userId, 'uploaded', false);
        await updateStatusTimestamp(userId, 'generated', false);
      }

      res.json({
        success: true,
        message: `Report for ${geneName} deleted successfully.`
      });
    } else {
      const query = `
        UPDATE users 
        SET report_uploaded = FALSE, report_url = NULL, report_generated = FALSE, reports = '{}'::jsonb, survey_requested = FALSE, report_answers = '{}'::jsonb, genotypes = '{}'::jsonb
        WHERE id = $1
        RETURNING id;
      `;
      const result = await pool.query(query, [userId]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      await updateStatusTimestamp(userId, 'uploaded', false);
      await updateStatusTimestamp(userId, 'generated', false);

      res.json({
        success: true,
        message: 'Report deleted successfully.'
      });
    }
  } catch (error) {
    console.error('Delete Report Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Update Report Verified Status Route
// ─────────────────────────────────────────────────────────────────────────────
app.put('/api/users/:id/verify-report', async (req, res) => {
  const userId = req.params.id;
  const { testName, reportVerified } = req.body;

  if (!testName) {
    return res.status(400).json({ error: 'testName is required.' });
  }

  try {
    const userRes = await pool.query('SELECT reports FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let reports = userRes.rows[0].reports || {};
    if (!reports[testName]) {
      return res.status(404).json({ error: `No report found for test "${testName}".` });
    }

    reports[testName].verified = !!reportVerified;
    reports[testName].verified_at = reportVerified ? new Date().toISOString() : null;

    // report_verified is an aggregate: true only once every generated panel is verified
    const generatedPanels = Object.values(reports).filter(r => r && r.ai_report);
    const allVerified = generatedPanels.length > 0 && generatedPanels.every(r => r.verified === true);

    const query = `
      UPDATE users
      SET reports = $1, report_verified = $2
      WHERE id = $3
      RETURNING id, report_verified;
    `;
    await pool.query(query, [JSON.stringify(reports), allVerified, userId]);

    if (allVerified) {
      await updateStatusTimestamp(userId, 'verified', true);
    }

    // Fetch updated user
    const updatedUserRes = await pool.query(`
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested,
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at
      FROM users WHERE id = $1
    `, [userId]);

    const updatedUser = updatedUserRes.rows[0];

    // Send notifications for this specific test only when it's newly verified
    if (reportVerified) {
      await sendWhatsAppReportReady(updatedUser, testName);
      await sendReportReadyEmail(updatedUser, testName);
    }

    res.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error('Update Report Verified Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Request Survey Route
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/users/:id/request-survey', express.json(), async (req, res) => {
  const userId = req.params.id;
  const requested = req.body.requested !== undefined ? req.body.requested : true;
  try {
    const result = await pool.query(
      `UPDATE users SET survey_requested = $1 WHERE id = $2 RETURNING id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, report_answers, status_timestamps, created_at`,
      [requested, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (requested) {
      // Send the email to the user
      await sendCollectAnswersEmail(result.rows[0]);
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error requesting survey:', error);
    res.status(500).json({ error: 'Server error requesting survey' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Submit Report Answers Route
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/users/:id/report-answers', express.json(), async (req, res) => {
  const userId = req.params.id;
  const { answers, rawAnswers, testName } = req.body; // e.g. { "1-1-0": 1, "2-2-1": 0 }

  try {
    // We need to map these answers to the actual python question IDs with their scores.
    // 1. Fetch test_questions to get the scores
    const questionsRes = await pool.query('SELECT * FROM test_questions ORDER BY id ASC');
    const testQuestions = questionsRes.rows;

    const mappedAnswers = {};
    for (const [uniqueId, optIdx] of Object.entries(answers)) {
      const [testId, subgeneIdx, qIndex] = uniqueId.split('-').map(Number);

      const test = testQuestions.find(t => t.id === testId);
      if (!test) continue;

      const subgeneKey = subgeneIdx === 1 ? 'subgene1_questions' : 'subgene2_questions';
      let qs = test[subgeneKey];
      if (typeof qs === 'string') qs = JSON.parse(qs);

      const question = qs[qIndex];
      if (!question || !question.options || !question.options[optIdx]) continue;

      const pythonKey = QUESTION_ID_MAP[testId]?.[subgeneIdx]?.[qIndex];
      if (pythonKey) {
        mappedAnswers[pythonKey] = question.options[optIdx].score;
      }
    }

    // 2. Fetch current user to merge or replace report_answers
    const userRes = await pool.query('SELECT full_name, email, phone, reports, report_answers FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];
    let currentAnswers = user.report_answers || {};
    if (typeof currentAnswers === 'string') currentAnswers = JSON.parse(currentAnswers);

    // Merge new mapped answers grouped by testName
    const updatedAnswers = {
      ...currentAnswers,
      [testName]: mappedAnswers
    };
    if (rawAnswers) {
      updatedAnswers[`${testName}_custom`] = rawAnswers;
    }

    let reports = user.reports || {};
    if (typeof reports === 'string') reports = JSON.parse(reports);

    const panelData = reports[testName];

    let anyGenerated = false;
    if (panelData && panelData.variants && !panelData.ai_report) {
      let category = '';
      if (testName.toLowerCase().includes('caffeine')) category = 'caffeine';
      else if (testName.toLowerCase().includes('muscle')) category = 'muscle';
      else if (testName.toLowerCase().includes('hair')) category = 'hair';
      else category = 'caffeine';

      console.log(`Triggering AI generation for ${category}...`);

      const payload = {
        category,
        genes: panelData.variants,
        phenotype_responses: mappedAnswers, // Send ONLY the mapped answers for this specific test
        lifestyle_context: {
          user_type: "explorer",
          raw_answers: rawAnswers || []
        }
      };
      console.log('Sending payload to Python backend:', JSON.stringify(payload));

      const url = process.env.PYTHON_BACKEND_URL ? `${process.env.PYTHON_BACKEND_URL}/dynamic/analyze-category` : 'http://127.0.0.1:8000/dynamic/analyze-category';
      try {
        const aiResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          reports[testName].ai_report = aiData.results || aiData;
          reports[testName].generated_at = new Date().toISOString();
          console.log(`AI generation successful for ${category}.`);
          anyGenerated = true;
        } else {
          const errorText = await aiResponse.text();
          console.error(`AI generation failed for ${category}: ${aiResponse.status} ${aiResponse.statusText} - ${errorText}`);
        }
      } catch (err) {
        console.error(`AI generation request failed for ${category}:`, err);
      }
    }

    if (anyGenerated) {
      try {
        const { sendWhatsAppReportGenerated } = require('./whatsapp');
        const { sendReportGeneratedEmail } = require('./mailer');

        await sendWhatsAppReportGenerated({ ...user, id: userId }, testName);
        await sendReportGeneratedEmail({ ...user, id: userId }, testName);
      } catch (e) { console.error("Notification failed:", e); }
    }

    // Check if there are any other panels still pending AI report
    let stillPending = false;
    for (const pk of Object.keys(reports)) {
      if (reports[pk] && reports[pk].variants && !reports[pk].ai_report) {
        stillPending = true;
        break;
      }
    }

    // report_generated is an aggregate: true only once every panel with variants has an ai_report
    const panelsWithVariants = Object.values(reports).filter(r => r && r.variants);
    const allGenerated = panelsWithVariants.length > 0 && panelsWithVariants.every(r => r.ai_report);

    // 3. Update DB
    const updateRes = await pool.query(
      `UPDATE users SET report_answers = $1, reports = $2, survey_requested = $3, report_generated = $4, report_url = $5, status_timestamps = jsonb_set(COALESCE(status_timestamps, '{}'::jsonb), '{generated}', to_jsonb(NOW()::text)) WHERE id = $6 RETURNING *`,
      [JSON.stringify(updatedAnswers), JSON.stringify(reports), stillPending, allGenerated, 'generated', userId]
    );

    res.json({ success: true, user: updateRes.rows[0] });
  } catch (error) {
    console.error('Error saving report answers:', error);
    res.status(500).json({ error: 'Server error saving answers' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Fetch / Retry Phenotypic Data Route
// Re-runs Google Sheet lookup + Gemini analysis for a user whose
// phenotypic_analysis is null (e.g. due to Gemini free-tier rate limits).
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/users/:id/fetch-phenotypic-data', async (req, res) => {
  const userId = req.params.id;

  try {
    // 1. Load the user from DB
    const userRes = await pool.query(
      `SELECT id, full_name, email, phone FROM users WHERE id = $1`,
      [userId]
    );
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = userRes.rows[0];

    // 2. Re-fetch Google Sheet data
    const force = req.query.force === 'true';
    console.log(`📊 [FetchData] Re-fetching Google Sheet for user #${userId}... (force=${force})`);
    let sheetData;
    try {
      sheetData = await fetchGoogleSheetData(force);
    } catch (sheetError) {
      return res.status(500).json({
        error: 'Failed to communicate with Google Sheets.',
        details: sheetError.message,
      });
    }

    if (!sheetData || sheetData.length === 0) {
      return res.status(404).json({ error: 'Google Sheet returned no data.' });
    }

    // 3. Run Gemini smart match
    console.log(`🤖 [FetchData] Running Gemini smart match for ${user.full_name}...`);
    const matchResult = await attemptSmartMapWithAI(
      user.full_name,
      user.email,
      user.phone,
      sheetData
    );

    if (matchResult.rate_limited) {
      return res.status(429).json({
        success: false,
        message: 'Gemini API is currently rate-limited. Please wait a minute and try again.',
      });
    }

    if (!matchResult.matched || !matchResult.matched_survey_data) {
      return res.status(200).json({
        success: false,
        message: 'Could not find a matching survey record for this user in Google Sheets.',
      });
    }

    // 4. Generate phenotypic analysis from matched data
    console.log(`🧬 [FetchData] Generating phenotypic analysis for user #${userId}...`);
    const analysisJSON = await generatePhenotypicAnalysis(matchResult.matched_survey_data, user.email, user.phone);

    if (!analysisJSON) {
      return res.status(500).json({
        success: false,
        message: 'Gemini returned no analysis. API may be temporarily unavailable.',
      });
    }

    // 5. Persist to DB
    await pool.query(
      `UPDATE users SET phenotypic_analysis = $1 WHERE id = $2`,
      [JSON.stringify(analysisJSON), userId]
    );

    // 6. Return updated user
    const updatedRes = await pool.query(
      `SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested,
              sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    console.log(`✅ [FetchData] Phenotypic analysis saved for user #${userId}.`);
    res.json({ success: true, user: updatedRes.rows[0] });
  } catch (error) {
    console.error('FetchPhenotypicData Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete User Route
// ─────────────────────────────────────────────────────────────────────────────
app.delete('/api/users/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    const query = `DELETE FROM users WHERE id = $1 RETURNING id;`;
    const result = await pool.query(query, [userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      success: true,
      message: 'User deleted successfully.'
    });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Delete Users Route
// ─────────────────────────────────────────────────────────────────────────────
app.delete('/api/users/bulk', async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'No user IDs provided' });
  }

  try {
    const query = `DELETE FROM users WHERE id = ANY($1::int[]) RETURNING id;`;
    const result = await pool.query(query, [userIds]);

    res.json({
      success: true,
      message: `${result.rowCount} users deleted successfully.`,
      deletedIds: result.rows.map(r => r.id)
    });
  } catch (error) {
    console.error('Bulk Delete Users Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Chat API
// ─────────────────────────────────────────────────────────────────────────────
const CHAT_PROMPT_LIMIT = 10;

app.post('/api/chat', express.json(), async (req, res) => {
  try {
    const { messages, userId } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (userId) {
      const usageResult = await pool.query('SELECT prompt_count FROM chat_usage WHERE user_id = $1', [userId]);
      const currentCount = usageResult.rows[0]?.prompt_count || 0;
      if (currentCount >= CHAT_PROMPT_LIMIT) {
        return res.status(403).json({ error: 'limit_reached', promptCount: currentCount });
      }
    }

    const reply = await generateChatResponse(messages);

    let promptCount = null;
    if (userId) {
      const incrementResult = await pool.query(
        `INSERT INTO chat_usage (user_id, prompt_count, updated_at) VALUES ($1, 1, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET prompt_count = chat_usage.prompt_count + 1, updated_at = CURRENT_TIMESTAMP
         RETURNING prompt_count`,
        [userId]
      );
      promptCount = incrementResult.rows[0].prompt_count;
    }

    res.json({ reply, promptCount });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate chat response' });
  }
});

// Per-user chat usage and history, so both sync across every device the user logs into.
app.get('/api/chat/usage/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query('SELECT prompt_count FROM chat_usage WHERE user_id = $1', [userId]);
    res.json({ promptCount: result.rows[0]?.prompt_count || 0 });
  } catch (error) {
    console.error('Chat Usage Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch chat usage' });
  }
});

app.get('/api/chat/sessions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT session_id AS id, title, messages, updated_at AS "updatedAt" FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('Chat Sessions Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
});

app.put('/api/chat/sessions/:userId/:sessionId', express.json(), async (req, res) => {
  try {
    const { userId, sessionId } = req.params;
    const { title, messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }
    await pool.query(
      `INSERT INTO chat_sessions (user_id, session_id, title, messages, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, session_id) DO UPDATE SET title = EXCLUDED.title, messages = EXCLUDED.messages, updated_at = CURRENT_TIMESTAMP`,
      [userId, sessionId, title || 'New chat', JSON.stringify(messages)]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Chat Session Save Error:', error);
    res.status(500).json({ error: 'Failed to save chat session' });
  }
});

app.delete('/api/chat/sessions/:userId/:sessionId', async (req, res) => {
  try {
    const { userId, sessionId } = req.params;
    await pool.query('DELETE FROM chat_sessions WHERE user_id = $1 AND session_id = $2', [userId, sessionId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Chat Session Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete chat session' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Test API for Report Generation (Split Screen)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Report Page Feedback Route
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/test/feedback', express.json(), async (req, res) => {
  const { test_name, page_index, emoji, feedback, mbq_id } = req.body;
  try {
    await pool.query(
      `INSERT INTO report_feedback (mbq_id, test_name, page_index, emoji, feedback)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (mbq_id, test_name, page_index)
       DO UPDATE SET emoji = EXCLUDED.emoji, feedback = EXCLUDED.feedback, created_at = CURRENT_TIMESTAMP`,
      [mbq_id || null, test_name || null, Number.isInteger(page_index) ? page_index : null, emoji || null, feedback || '']
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Report Feedback Error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Lets the viewer know which pages of a given report already have feedback, so a
// returning user (or a re-opened modal) isn't asked again for pages they already
// answered.
app.get('/api/test/feedback', async (req, res) => {
  const { test_name, mbq_id } = req.query;
  if (!test_name || !mbq_id) {
    return res.json({ feedback: [] });
  }
  try {
    const result = await pool.query(
      `SELECT page_index, emoji, feedback FROM report_feedback WHERE test_name = $1 AND mbq_id = $2`,
      [test_name, mbq_id]
    );
    res.json({ feedback: result.rows });
  } catch (error) {
    console.error('Fetch Report Feedback Error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Upcoming Test Interest Routes (shown during the report download countdown)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/test/interest', express.json(), async (req, res) => {
  const { mbq_id, test_name, interested } = req.body;
  if (!mbq_id || !test_name) {
    return res.status(400).json({ error: 'mbq_id and test_name are required.' });
  }
  try {
    await pool.query(
      `INSERT INTO test_interests (mbq_id, test_name, interested)
       VALUES ($1, $2, $3)
       ON CONFLICT (mbq_id, test_name)
       DO UPDATE SET interested = EXCLUDED.interested, created_at = CURRENT_TIMESTAMP`,
      [mbq_id, test_name, !!interested]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Save Test Interest Error:', error);
    res.status(500).json({ error: 'Failed to save interest' });
  }
});

app.get('/api/test/interests', async (req, res) => {
  const { mbq_id } = req.query;
  if (!mbq_id) {
    return res.json({ interests: [] });
  }
  try {
    const result = await pool.query(
      `SELECT test_name, interested FROM test_interests WHERE mbq_id = $1`,
      [mbq_id]
    );
    res.json({ interests: result.rows });
  } catch (error) {
    console.error('Fetch Test Interests Error:', error);
    res.status(500).json({ error: 'Failed to fetch interests' });
  }
});

app.post('/api/test/generate-report', async (req, res) => {
  try {
    const { answers, rawAnswers, email = 'test@example.com', phone = '1234567890', testName, geneVariants } = req.body;

    if (!answers || Object.keys(answers).length === 0) {
      return res.status(400).json({ error: 'Answers are required' });
    }

    // Map testName to category and get testId
    let category = '';
    let testId = 1;
    if (testName.toLowerCase().includes('caffeine')) { category = 'caffeine'; testId = 1; }
    else if (testName.toLowerCase().includes('muscle')) { category = 'muscle'; testId = 2; }
    else if (testName.toLowerCase().includes('hair')) { category = 'hair'; testId = 3; }
    else { category = 'caffeine'; testId = 1; }

    const { QUESTION_ID_MAP } = require('./questionMapper');

    // Map the answers: uniqueId (e.g. "1-1-0") -> optIdx (e.g. 0, 1, 2)
    // to python key (e.g. "cyp1a2_duration_effect") -> score (e.g. 1, 0, -1)
    const pythonResponses = {};
    for (const [uniqueId, optIdx] of Object.entries(answers)) {
      const parts = uniqueId.split('-');
      if (parts.length === 3) {
        const tId = parts[0];
        const subId = parts[1];
        const qIdx = parseInt(parts[2], 10);

        // Map optIdx to score: 0 -> 1, 1 -> 0, 2 -> -1
        let score = 0;
        if (optIdx === 0) score = 1;
        else if (optIdx === 1) score = 0;
        else if (optIdx === 2) score = -1;
        else score = parseInt(optIdx, 10); // fallback if they already sent score

        if (QUESTION_ID_MAP[tId] && QUESTION_ID_MAP[tId][subId]) {
          const pyKey = QUESTION_ID_MAP[tId][subId][qIdx];
          if (pyKey) {
            pythonResponses[pyKey] = score;
          }
        }
      } else {
        // Fallback if the frontend sends string keys directly
        pythonResponses[uniqueId] = parseInt(optIdx, 10);
      }
    }

    const payload = {
      category,
      genes: geneVariants,
      phenotype_responses: pythonResponses,
      lifestyle_context: {
        user_type: "explorer",
        raw_answers: rawAnswers || []
      }
    };

    console.log(`Sending request to Python backend for category: ${category}`);

    // Call Python backend
    const url = process.env.PYTHON_BACKEND_URL ? `${process.env.PYTHON_BACKEND_URL}/dynamic/analyze-category` : 'http://127.0.0.1:8080/dynamic/analyze-category';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Python backend error: ${response.status} ${errorText}`);
    }

    const analysisJSON = await response.json();

    res.json({ success: true, report: analysisJSON });
  } catch (error) {
    console.error('Test Report Generation Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate test report' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin WhatsApp Notification Trigger Route
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/admin/patients/:id/notify-whatsapp', async (req, res) => {
  const userId = req.params.id;
  const { templateType, testName } = req.body;

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = userRes.rows[0];

    switch (templateType) {
      case 'sample_collected':
        await sendWhatsAppSampleDispatched(user);
        break;
      case 'report_generated':
        await sendWhatsAppReportGenerated(user, testName);
        break;
      case 'report_ready':
        await sendWhatsAppReportReady(user, testName);
        break;
      default:
        return res.status(400).json({ error: 'Invalid template type' });
    }

    res.json({ success: true, message: `WhatsApp message (${templateType}) sent successfully!` });
  } catch (error) {
    console.error('Manual WhatsApp Trigger Error:', error);
    res.status(500).json({ error: 'Failed to send WhatsApp message' });
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
