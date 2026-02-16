// src/services/blockchain.service.js
import axios from "axios";
import ApiError from "../utility/ApiError.js";

const BASE = process.env.BLOCKCHAIN_HTTP_BASE?.replace(/\/$/, "") || null;
const AUTH_KEY = process.env.BLOCKCHAIN_API_KEY || null; // optional secret for teammate API

const httpClient = axios.create({
  baseURL: BASE,
  timeout: parseInt(process.env.BLOCKCHAIN_HTTP_TIMEOUT || "15000", 10),
  headers: {
    "Content-Type": "application/json",
    ...(AUTH_KEY ? { "x-api-key": AUTH_KEY } : {})
  }
});

async function registerUserOnLedger(userPayload) {
  if (!BASE) throw new ApiError(500, "BLOCKCHAIN_HTTP_BASE not configured");
  const resp = await httpClient.post("/registerUser", userPayload);
  return resp.data; // assume teammate returns JSON { ledgerId: '...', ... }
}

async function recordTransactionOnLedger(transactionPayload) {
  if (!BASE) throw new ApiError(500, "BLOCKCHAIN_HTTP_BASE not configured");
  const resp = await httpClient.post("/recordTransaction", transactionPayload);
  return resp.data; // assume { txId: '...', status: 'success', ... }
}

async function getTransactionFromLedger(txId) {
  if (!BASE) throw new ApiError(500, "BLOCKCHAIN_HTTP_BASE not configured");
  const resp = await httpClient.get(`/transaction/${encodeURIComponent(txId)}`);
  return resp.data;
}

export default {
  mode: "http",
  registerUserOnLedger,
  recordTransactionOnLedger,
  getTransactionFromLedger
};
