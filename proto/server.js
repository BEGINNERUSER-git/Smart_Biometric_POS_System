// server.js
const express = require('express');
const fetch = require('node-fetch'); // node >=18 has fetch builtin; else install node-fetch
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const upload = multer();
const app = express();
app.use(express.json());

// DB open
let db;
(async () => {
  db = await open({ filename: './pos_demo.db', driver: sqlite3.Database });
  // create tables if not exist (safe)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE IF NOT EXISTS accounts (user_id INTEGER PRIMARY KEY, balance REAL);
    CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount REAL, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT, result TEXT, score REAL, feature_hash TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
})();

// helper to do transaction
async function doTransaction(user_id, amount) {
  // simple check & debit
  const row = await db.get('SELECT balance FROM accounts WHERE user_id = ?', user_id);
  if (!row) return { success: false, reason: 'user_not_found' };
  if (row.balance < amount) return { success: false, reason: 'insufficient_funds' };
  const newBal = row.balance - amount;
  await db.run('UPDATE accounts SET balance = ? WHERE user_id = ?', newBal, user_id);
  const trx = await db.run('INSERT INTO transactions (user_id, amount, status) VALUES (?, ?, ?)', user_id, amount, 'done');
  return { success: true, transactionId: trx.lastID, newBalance: newBal };
}

// POST /pay expects multipart form: fields user_id, amount, file
app.post('/pay', upload.single('file'), async (req, res) => {
  try {
    const user_id = parseInt(req.body.user_id);
    const amount = parseFloat(req.body.amount);
    if (!user_id || !amount || !req.file) return res.status(400).json({ error: 'missing params' });

    // Call ML service
    const mlRes = await fetch('http://localhost:5001/infer', {
      method: 'POST',
      body: (() => {
        // create a FormData and append the file buffer
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', req.file.buffer, { filename: req.file.originalname || 'upload.png' });
        return form;
      })()
    });

    const mlJson = await mlRes.json();
    // write audit record regardless of result
    await db.run('INSERT INTO audit (user_id, action, result, score, feature_hash) VALUES (?, ?, ?, ?, ?)',
                 user_id, 'auth_attempt', mlJson.status || 'error', mlJson.score || 0.0, mlJson.feature_hash || '');

    if (mlJson.status !== 'legit') {
      return res.json({ success: false, reason: 'verification_failed', ml: mlJson });
    }

    // ML verified → do transaction
    const trx = await doTransaction(user_id, amount);
    if (!trx.success) {
      await db.run('INSERT INTO audit (user_id, action, result, score, feature_hash) VALUES (?, ?, ?, ?, ?)',
                   user_id, 'transaction', 'failed:' + trx.reason, mlJson.score || 0.0, mlJson.feature_hash || '');
      return res.json({ success: false, reason: trx.reason });
    }

    await db.run('INSERT INTO audit (user_id, action, result, score, feature_hash) VALUES (?, ?, ?, ?, ?)',
                 user_id, 'transaction', 'success', mlJson.score || 0.0, mlJson.feature_hash || '');

    return res.json({ success: true, transactionId: trx.transactionId, newBalance: trx.newBalance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error', msg: err.message });
  }
});

app.listen(3000, () => console.log('POS backend running on 3000'));
