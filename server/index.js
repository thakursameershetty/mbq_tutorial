require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { google } = require('googleapis');
const { attemptSmartMapWithAI, generatePhenotypicAnalysis, getKeyPoolStatus, getSheetCacheStatus, getCachedSheetData, setCachedSheetData, invalidateSheetCache } = require('./aiMapping');
const { sendSampleDispatchedEmail, sendForgotCredentialsEmail, sendOtpEmail, sendReportReadyEmail } = require('./mailer');
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
  const { username, fullName, email, phone, age, gender, geneType, otp } = req.body;

  if (!otp) {
    return res.status(400).json({ error: 'OTP is required' });
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
      INSERT INTO users (username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, status_timestamps)
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
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, 
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at
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

  const reportUrl = req.file.path; // Cloudinary returns the full secure URL in path
  const genotypes = req.body.genotypes ? JSON.parse(req.body.genotypes) : null;
  const geneName = req.body.geneName;

  try {
    const userRes = await pool.query('SELECT reports, genotypes FROM users WHERE id = $1', [userId]);
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

    // Mock auto-generating the phenotypic report logic immediately after uploading genomic PDF
    await pool.query(`
      UPDATE users
      SET report_generated = TRUE
      WHERE id = $1
    `, [userId]);
    await updateStatusTimestamp(userId, 'generated', true);

    // Fetch updated user
    const updatedUserRes = await pool.query(`
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, 
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at
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
        SET report_uploaded = FALSE, report_url = NULL, report_generated = FALSE, reports = '{}'::jsonb
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
      SELECT id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, 
             sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at
      FROM users WHERE id = $1
    `, [userId]);

    const updatedUser = updatedUserRes.rows[0];

    // Send email if report is verified
    if (reportVerified) {
      await sendReportReadyEmail(updatedUser);
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
      `UPDATE users SET survey_requested = $1 WHERE id = $2 RETURNING id, username, full_name, email, phone, age, gender, gene_type, phenotypic_analysis, survey_requested, sample_collected, sample_received, report_uploaded, report_generated, report_verified, report_url, reports, status_timestamps, created_at`,
      [requested, userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error requesting survey:', error);
    res.status(500).json({ error: 'Server error requesting survey' });
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

// Start the server (only locally, not on Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running locally on port ${port}`);
  });
}

// Crucial for Vercel serverless integration
module.exports = app;
