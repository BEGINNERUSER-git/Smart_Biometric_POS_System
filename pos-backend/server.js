const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { pool, initDb } = require("./db");
const { getPalmPaymentContract } = require("./gateway");

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, cb) {
      // allow server-to-server, curl, and same-origin
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);

// Ensure DB table exists before handling any requests.
initDb()
  .then(() => {
    console.log("Database initialized (biometric_transactions table ready).");
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

// --- SSE (Server-Sent Events) for real-time transaction updates ---
const clients = new Set();

function sseBroadcast(eventName, payload) {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(data);
    } catch (_) {
      // ignore broken connections
    }
  }
}

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // initial heartbeat
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  clients.add(res);
  req.on("close", () => {
    clients.delete(res);
  });
});

// Recent transactions from PostgreSQL
app.get("/api/transactions", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
    const result = await pool.query(
      "SELECT tx_id, user_id, amount, status, created_at FROM biometric_transactions ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    res.json({ items: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// User balance lookup from chaincode
app.get("/api/balance", async (req, res) => {
  const palmHash = req.query.palmHash;
  if (!palmHash || typeof palmHash !== "string") {
    return res.status(400).json({ error: "palmHash query param is required" });
  }

  let gateway;
  try {
    const gwResult = await getPalmPaymentContract();
    gateway = gwResult.gateway;
    const contract = gwResult.contract;
    const buffer = await contract.evaluateTransaction("GetBalance", palmHash);
    const value = buffer.toString("utf8");
    const balance = parseFloat(value);
    if (!Number.isFinite(balance)) {
      return res.status(200).json({ palmHash, balanceRaw: value });
    }
    return res.status(200).json({ palmHash, balance });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch balance",
      details: err && err.message ? err.message : String(err)
    });
  } finally {
    if (gateway) {
      try {
        await gateway.disconnect();
      } catch (_) {}
    }
  }
});

app.post("/api/pay", async (req, res) => {
  const { userId, merchantId, amount, palmHash } = req.body || {};

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId is required and must be a string" });
  }
  if (!merchantId || typeof merchantId !== "string") {
    return res.status(400).json({ error: "merchantId is required and must be a string" });
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (!palmHash || typeof palmHash !== "string") {
    return res.status(400).json({ error: "palmHash is required and must be a string" });
  }

  let gateway;
  try {
    const gwResult = await getPalmPaymentContract();
    gateway = gwResult.gateway;
    const contract = gwResult.contract;

    sseBroadcast("tx", {
      status: "PROCESSING",
      userId,
      merchantId,
      amount,
      palmHash
    });

    // Match the Go chaincode signature:
    // VerifyAndPay(palmHash string, merchantID string, amount float64)
    const transaction = contract.createTransaction("VerifyAndPay");
    const txId = transaction.getTransactionId();

    const resultBuffer = await transaction.submit(palmHash, merchantId, amount.toString());
    const result = resultBuffer.toString("utf8") || "APPROVED";

    // Persist a copy of the receipt to PostgreSQL.
    const status = result.toUpperCase() === "APPROVED" ? "SUCCESS" : "UNKNOWN";
    await pool.query(
      "INSERT INTO biometric_transactions (tx_id, user_id, amount, status) VALUES ($1, $2, $3, $4) ON CONFLICT (tx_id) DO NOTHING",
      [txId, userId, amount, status]
    );

    sseBroadcast("tx", {
      status: status === "SUCCESS" ? "CONFIRMED" : status,
      txId,
      userId,
      merchantId,
      amount,
      palmHash,
      onChainResult: result
    });

    return res.status(200).json({
      txId,
      status,
      onChainResult: result
    });
  } catch (err) {
    console.error("Error processing /api/pay:", err);

    sseBroadcast("tx", {
      status: "DENIED",
      userId,
      merchantId,
      amount,
      palmHash,
      error: err && err.message ? err.message : String(err)
    });

    return res.status(500).json({
      error: "Failed to process biometric payment",
      details: err && err.message ? err.message : String(err)
    });
  } finally {
    if (gateway) {
      try {
        await gateway.disconnect();
      } catch (e) {
        // ignore disconnect errors
      }
    }
  }
});

app.listen(port, () => {
  console.log(`POS backend listening on port ${port}`);
});

