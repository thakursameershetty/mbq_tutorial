const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT reports FROM users WHERE id = 81').then(res => {
  console.log(Object.keys(res.rows[0].reports));
  process.exit();
});
