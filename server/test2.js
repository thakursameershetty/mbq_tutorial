const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT reports FROM users WHERE id = 81').then(res => {
  console.log(JSON.stringify(res.rows[0].reports, null, 2));
  process.exit();
});
