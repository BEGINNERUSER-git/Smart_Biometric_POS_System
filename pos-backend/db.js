const { Pool } = require("pg");

require("dotenv").config();

// Use standard PG environment variables or explicit config.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl:
    process.env.PGSSL && process.env.PGSSL.toLowerCase() === "true"
      ? { rejectUnauthorized: false }
      : undefined
});

async function initDb() {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS biometric_transactions (
      id SERIAL PRIMARY KEY,
      tx_id VARCHAR(128) UNIQUE NOT NULL,
      user_id VARCHAR(128) NOT NULL,
      amount NUMERIC(18, 4) NOT NULL,
      status VARCHAR(32) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await pool.query(createTableSql);
}

module.exports = {
  pool,
  initDb
};

