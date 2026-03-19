"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TxStatus = "WAITING" | "PROCESSING" | "CONFIRMED" | "DENIED";

type RecentTx = {
  tx_id: string;
  user_id: string;
  amount: string | number;
  status: string;
  created_at: string;
};

function getEnv(name: string, fallback: string) {
  const v = (process.env as any)[name];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

const BACKEND_URL = getEnv("NEXT_PUBLIC_BACKEND_URL", "http://localhost:5000");
const ML_URL = getEnv("NEXT_PUBLIC_ML_URL", "http://localhost:7000");

export default function Dashboard() {
  const [userId, setUserId] = useState("user-123");
  const [merchantId, setMerchantId] = useState("merchant-xyz");
  const [amount, setAmount] = useState(25.5);
  const [palmHash, setPalmHash] = useState("");

  const [status, setStatus] = useState<TxStatus>("WAITING");
  const [statusMsg, setStatusMsg] = useState<string>("Ready");
  const [recent, setRecent] = useState<RecentTx[]>([]);

  const [balancePalmHash, setBalancePalmHash] = useState("");
  const [balance, setBalance] = useState<string>("-");
  const [busy, setBusy] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  const statusDotClass = useMemo(() => {
    if (status === "WAITING") return "dot dotWaiting";
    if (status === "PROCESSING") return "dot dotProcessing";
    if (status === "CONFIRMED") return "dot dotConfirmed";
    return "dot dotDenied";
  }, [status]);

  async function refreshRecent() {
    const res = await fetch(`${BACKEND_URL}/api/transactions?limit=20`, {
      cache: "no-store"
    });
    if (!res.ok) return;
    const data = await res.json();
    setRecent(Array.isArray(data?.items) ? data.items : []);
  }

  useEffect(() => {
    refreshRecent();
  }, []);

  useEffect(() => {
    const es = new EventSource(`${BACKEND_URL}/api/events`);
    eventSourceRef.current = es;

    es.addEventListener("connected", () => {
      // no-op
    });

    es.addEventListener("tx", (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload?.status === "PROCESSING") {
          setStatus("PROCESSING");
          setStatusMsg("Transaction submitted, waiting for commit…");
        } else if (payload?.status === "CONFIRMED") {
          setStatus("CONFIRMED");
          setStatusMsg(`Confirmed. TxID: ${payload?.txId || "-"}`);
          refreshRecent();
        } else if (payload?.status === "DENIED") {
          setStatus("DENIED");
          setStatusMsg(payload?.error || "Denied");
        }
      } catch {
        // ignore malformed events
      }
    });

    es.onerror = () => {
      // keep UI usable; user can still submit and see HTTP response
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  async function scanPalm() {
    setBusy(true);
    setStatus("PROCESSING");
    setStatusMsg("Capturing palm and generating hash…");

    try {
      const res = await fetch(`${ML_URL}/scan-and-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          merchantId,
          amount,
          sample: "browser-scan"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus("DENIED");
        setStatusMsg(typeof data?.detail === "string" ? data.detail : "Scan/Pay failed");
        return;
      }

      setPalmHash(data?.palmHash || "");
      const backend = data?.backend;
      if (backend?.status === "SUCCESS") {
        setStatus("CONFIRMED");
        setStatusMsg(`Confirmed. TxID: ${backend.txId}`);
        refreshRecent();
      } else {
        setStatus("PROCESSING");
        setStatusMsg("Submitted. Waiting for confirmation events…");
      }
    } catch (e: any) {
      setStatus("DENIED");
      setStatusMsg(e?.message || "Failed to reach ML bridge");
    } finally {
      setBusy(false);
    }
  }

  async function lookupBalance() {
    setBalance("…");
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/balance?palmHash=${encodeURIComponent(balancePalmHash)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) {
        setBalance("Error");
        return;
      }
      if (typeof data?.balance === "number") {
        setBalance(data.balance.toFixed(2));
      } else {
        setBalance(String(data?.balanceRaw ?? "-"));
      }
    } catch {
      setBalance("Error");
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="title">Merchant Dashboard</div>
          <div className="subtitle">
            Smart Biometric POS • Fabric + PostgreSQL + ML
          </div>
        </div>
        <span className="statusPill" title="Real-time status from backend">
          <span className={statusDotClass} />
          <span>{status}</span>
          <span className="muted">—</span>
          <span className="muted">{statusMsg}</span>
        </span>
      </div>

      <div className="grid">
        <div className="card">
          <div className="cardTitle">Scan & Pay</div>
          <div className="row">
            <input
              className="input"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID"
            />
            <input
              className="input"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="Merchant ID"
            />
            <input
              className="input"
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              placeholder="Amount"
            />
            <button className="btn" onClick={scanPalm} disabled={busy}>
              Scan Palm
            </button>
          </div>
          <div style={{ marginTop: 12 }} className="muted small">
            Last palm hash:{" "}
            <span className="mono">{palmHash ? palmHash.slice(0, 18) + "…" : "-"}</span>
          </div>
          <div style={{ marginTop: 10 }} className="muted small">
            ML Bridge: <span className="mono">{ML_URL}</span> • Backend:{" "}
            <span className="mono">{BACKEND_URL}</span>
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">User Balance Lookup</div>
          <div className="row">
            <input
              className="input"
              value={balancePalmHash}
              onChange={(e) => setBalancePalmHash(e.target.value)}
              placeholder="Palm hash"
            />
            <button className="btn btnSecondary" onClick={lookupBalance}>
              Lookup
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="muted small">Balance</div>
            <div style={{ fontSize: 26, fontWeight: 750 }}>
              {balance} <span className="muted" style={{ fontSize: 14 }}>USD</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div className="cardTitle">Recent Transactions</div>
        <div className="muted small" style={{ marginBottom: 10 }}>
          Pulled from PostgreSQL (`biometric_transactions`)
        </div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Tx ID</th>
              <th>User</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No transactions yet.
                </td>
              </tr>
            ) : (
              recent.map((t) => (
                <tr key={t.tx_id}>
                  <td className="muted small">
                    {t.created_at ? new Date(t.created_at).toLocaleString() : "-"}
                  </td>
                  <td className="mono small">{t.tx_id.slice(0, 14)}…</td>
                  <td>{t.user_id}</td>
                  <td>{typeof t.amount === "string" ? t.amount : t.amount.toFixed?.(2) ?? t.amount}</td>
                  <td>{t.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

