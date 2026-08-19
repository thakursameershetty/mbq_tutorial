const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT reports FROM users WHERE id = 81').then(async res => {
  let reports = res.rows[0].reports || {};
  reports["Muscle Power vs Endurance"] = {
    variants: { ACTN3: "RR", ACE: "II" }
  };
  await pool.query('UPDATE users SET reports = $1, survey_requested = TRUE WHERE id = 81', [JSON.stringify(reports)]);
  console.log("Updated!");
  process.exit();
});
