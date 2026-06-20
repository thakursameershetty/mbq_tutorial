require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { google } = require('googleapis');
const { attemptSmartMapWithAI, generatePhenotypicAnalysis } = require('./aiMapping');
const { sendSampleDispatchedEmail } = require('./mailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5001;

// Setup static file serving for uploads
// On Vercel, the default filesystem is read-only, so we fallback to /tmp/uploads
const uploadsDir = process.env.VERCEL || process.env.NODE_ENV === 'production'
  ? '/tmp/uploads'
  : path.join(__dirname, 'uploads');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.warn('Unable to create uploads directory:', err.message);
}

app.use('/uploads', express.static(uploadsDir));

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
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

    const initialTimestamps = JSON.stringify({
      registered: new Date().toISOString()
    });

    const insertUserQuery = `
      INSERT INTO users (username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, status_timestamps)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id;
    `;
    const userResult = await pool.query(insertUserQuery, [
      username, fullName, email, phone, age, gender, geneType,
      analysisJSON ? JSON.stringify(analysisJSON) : null,
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
        id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, 
        sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, status_timestamps, created_at
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
      RETURNING id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, 
                sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, status_timestamps, created_at;
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
        id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, 
        sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, status_timestamps, created_at
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
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, 
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, status_timestamps, created_at
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
  const { sampleReceived } = req.body;

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
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, 
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, status_timestamps, created_at
      FROM users WHERE id = $1
    `, [userId]);

    res.json({
      success: true,
      user: updatedUserRes.rows[0]
    });
  } catch (error) {
    console.error('Update Sample Received Error:', error);
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

  const reportUrl = `/uploads/${req.file.filename}`;

  try {
    const query = `
      UPDATE users 
      SET report_uploaded = TRUE, report_url = $1
      WHERE id = $2
      RETURNING id, report_uploaded, report_url;
    `;
    const result = await pool.query(query, [reportUrl, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await updateStatusTimestamp(userId, 'uploaded', true);

    // Mock auto-generating the phenotypic report logic immediately after uploading genomic PDF
    await pool.query(`
      UPDATE users
      SET report_generated = TRUE
      WHERE id = $1
    `, [userId]);
    await updateStatusTimestamp(userId, 'generated', true);

    // Fetch updated user
    const updatedUserRes = await pool.query(`
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, 
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, status_timestamps, created_at
      FROM users WHERE id = $1
    `, [userId]);

    res.json({
      success: true,
      message: 'Report uploaded and generated successfully.',
      user: updatedUserRes.rows[0]
    });
  } catch (error) {
    console.error('Upload Report Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Update Report Verified Status Route
// ─────────────────────────────────────────────────────────────────────────────
app.put('/api/users/:id/verify-report', async (req, res) => {
  const userId = req.params.id;
  const { reportVerified } = req.body;

  try {
    const query = `
      UPDATE users 
      SET report_verified = $1
      WHERE id = $2
      RETURNING id, report_verified;
    `;
    const result = await pool.query(query, [reportVerified, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await updateStatusTimestamp(userId, 'verified', reportVerified);

    // Fetch updated user
    const updatedUserRes = await pool.query(`
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, 
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, status_timestamps, created_at
      FROM users WHERE id = $1
    `, [userId]);

    res.json({
      success: true,
      user: updatedUserRes.rows[0]
    });
  } catch (error) {
    console.error('Update Report Verified Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
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
