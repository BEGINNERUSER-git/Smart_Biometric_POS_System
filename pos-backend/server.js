const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();

const { pool, initDb } = require("./db");
const { getPalmPaymentContract } = require("./gateway");

const app = express();
const port = process.env.PORT || 4000;

app.use(bodyParser.json());

// Ensure DB table exists before handling any requests.
initDb()
  .then(() => {
    console.log("Database initialized (biometric_transactions table ready).");
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
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

    return res.status(200).json({
      txId,
      status,
      onChainResult: result
    });
  } catch (err) {
    console.error("Error processing /api/pay:", err);
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

