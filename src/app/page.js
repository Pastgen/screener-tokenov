"use client";

import { useEffect, useMemo, useState } from "react";

function usd(value) {
  return "$" + Math.round(Number(value || 0)).toLocaleString("en-US");
}

function num(value) {
  return Math.round(Number(value || 0)).toLocaleString("en-US");
}

function feePct(v) {
  const n = Number(v || 0) * 100;
  if (n === 0) return "0%";
  return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "") + "%";
}

export default function Home() {
  const [rows, setRows] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [onlyZero, setOnlyZero] = useState(false);
  const [sortKey, setSortKey] = useState("maxSizeUsd");
  const [copied, setCopied] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mexc", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to load");
      setRows(data.rows || []);
      setUpdatedAt(data.updatedAt);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.symbol.toLowerCase().includes(q))
      .filter((r) => !onlyZero || r.isZeroFee)
      .sort((a, b) => {
        if (sortKey === "maxLeverage") return b.maxLeverage - a.maxLeverage;
        return b.maxSizeUsd - a.maxSizeUsd;
      });
  }, [rows, search, onlyZero, sortKey]);

  async function copySymbol(symbol) {
    try {
      await navigator.clipboard.writeText(symbol);
      setCopied(symbol);
      setTimeout(() => setCopied(""), 1100);
    } catch {}
  }

  return (
    <main className="page">
      <section className="header">
        <div>
          <p className="tag">MEXC Futures Scanner</p>
          <h1>Лимиты позиции и 0 fee</h1>
          <p className="sub">
            Max size показывает общий максимальный размер позиции в $, отдельно от max leverage. Плечо не привязывается к размеру позиции.
          </p>
          <p className="updated">Updated: {updatedAt ? new Date(updatedAt).toLocaleString("ru-RU") : "—"}</p>
        </div>
        <button className="refresh" onClick={load} disabled={loading}>{loading ? "Обновляю..." : "Обновить"}</button>
      </section>

      <section className="panel filters">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск: BTC, TIA, PEPE..." />
        <label className="check"><input type="checkbox" checked={onlyZero} onChange={(e) => setOnlyZero(e.target.checked)} /> Только 0 fee</label>
        <button className={sortKey === "maxSizeUsd" ? "active" : ""} onClick={() => setSortKey("maxSizeUsd")}>Max size ↓</button>
        <button className={sortKey === "maxLeverage" ? "active" : ""} onClick={() => setSortKey("maxLeverage")}>Max leverage ↓</button>
      </section>

      {error && <div className="err">Ошибка: {error}</div>}
      {copied && <div className="toast">Скопировано: {copied}</div>}

      <section className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Max size $</th>
              <th>Contracts</th>
              <th>Max leverage</th>
              <th>0 fee</th>
              <th>Maker / Taker</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.symbol}>
                <td><button className="symbol" onClick={() => copySymbol(r.symbol)} title="Click to copy">{r.symbol}</button></td>
                <td className="money">{usd(r.maxSizeUsd)}</td>
                <td>{num(r.overallMaxContracts)}</td>
                <td>{r.maxLeverage}x</td>
                <td><span className={r.isZeroFee ? "yes" : "no"}>{r.isZeroFee ? "YES" : "NO"}</span></td>
                <td>{feePct(r.makerFee)} / {feePct(r.takerFee)}</td>
                <td>{Number(r.price).toLocaleString("en-US", { maximumSignificantDigits: 10 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <style jsx>{`
        * { box-sizing: border-box; }
        .page {
          min-height: 100vh;
          background: radial-gradient(circle at top left, rgba(32, 208, 159, 0.08), transparent 34%), #070b12;
          color: #eef5ff;
          padding: 42px 20px;
          font-family: Inter, Arial, sans-serif;
        }
        .header, .panel, .tableWrap { max-width: 1180px; margin: 0 auto; }
        .header {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: start;
          gap: 24px;
          margin-bottom: 22px;
        }
        .tag { color: #22e6c2; font-weight: 900; margin: 0 0 8px; font-size: 13px; letter-spacing: .02em; }
        h1 { margin: 0; font-size: 34px; line-height: 1.05; letter-spacing: -0.04em; }
        .sub { color: #a9b9d6; margin: 10px 0 0; max-width: 780px; line-height: 1.45; }
        .updated { color: #8ea2c3; font-size: 13px; margin: 14px 0 0; }
        .refresh, .filters button {
          border: 0;
          border-radius: 14px;
          font-weight: 900;
          padding: 13px 20px;
          cursor: pointer;
          transition: transform .12s ease, opacity .12s ease, border-color .12s ease;
          white-space: nowrap;
        }
        .refresh:hover, .filters button:hover { transform: translateY(-1px); }
        .refresh:disabled { opacity: .65; cursor: default; transform: none; }
        .refresh, .filters button.active { background: #20d09f; color: #061018; }
        .filters button { background: #102143; color: #eef5ff; border: 1px solid #254675; }
        .panel {
          background: rgba(16, 25, 38, .92);
          border: 1px solid #223753;
          border-radius: 18px;
          padding: 14px;
          display: grid;
          grid-template-columns: minmax(220px, 320px) 1fr auto auto auto;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          box-shadow: 0 14px 40px rgba(0,0,0,.18);
        }
        input {
          width: 100%;
          background: #07101c;
          border: 1px solid #2d476b;
          color: white;
          border-radius: 13px;
          padding: 13px 16px;
          outline: none;
          font-weight: 700;
        }
        input:focus { border-color: #20d09f; }
        .check {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #e8f1ff;
          font-weight: 850;
          white-space: nowrap;
        }
        .check input { width: 16px; height: 16px; min-width: 16px; accent-color: #20d09f; }
        .tableWrap {
          overflow: auto;
          border: 1px solid #223753;
          border-radius: 16px;
          background: rgba(16, 25, 38, .94);
          box-shadow: 0 18px 46px rgba(0,0,0,.22);
        }
        table { width: 100%; border-collapse: collapse; min-width: 900px; table-layout: fixed; }
        th {
          color: #78b7ff;
          font-size: 13px;
          text-align: left;
          padding: 15px 16px;
          background: #101b2b;
          border-bottom: 1px solid #263a58;
          font-weight: 900;
        }
        td {
          padding: 17px 16px;
          border-bottom: 1px solid #22334d;
          font-weight: 760;
          vertical-align: middle;
        }
        tr:last-child td { border-bottom: 0; }
        th:nth-child(1), td:nth-child(1) { width: 20%; }
        th:nth-child(2), td:nth-child(2) { width: 18%; }
        th:nth-child(3), td:nth-child(3) { width: 16%; }
        th:nth-child(4), td:nth-child(4) { width: 13%; }
        th:nth-child(5), td:nth-child(5) { width: 11%; }
        th:nth-child(6), td:nth-child(6) { width: 13%; }
        th:nth-child(7), td:nth-child(7) { width: 12%; }
        .money { color: #29f0ad; font-size: 18px; font-weight: 1000; letter-spacing: -0.02em; }
        .symbol {
          background: transparent;
          color: white;
          border: 0;
          font: inherit;
          font-weight: 1000;
          cursor: pointer;
          padding: 0;
          letter-spacing: .01em;
        }
        .symbol:hover { color: #20d09f; }
        .yes, .no {
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 12px;
          font-weight: 1000;
          display: inline-block;
          min-width: 44px;
          text-align: center;
        }
        .yes { color: #9fffd6; background: rgba(20, 185, 120, .42); }
        .no { color: #ffb4c3; background: rgba(220, 40, 80, .28); }
        .err { max-width: 1180px; margin: 0 auto 16px; color: #ffbac7; background: #35111b; border: 1px solid #7b2235; padding: 12px; border-radius: 12px; }
        .toast { position: fixed; right: 24px; bottom: 24px; background: #20d09f; color: #071016; padding: 13px 18px; border-radius: 14px; font-weight: 1000; box-shadow: 0 12px 34px rgba(0,0,0,.35); }
        @media (max-width: 900px) {
          .header { grid-template-columns: 1fr; }
          .panel { grid-template-columns: 1fr; align-items: stretch; }
          .check { justify-self: start; }
          .refresh, .filters button { width: 100%; }
        }
      `}</style>
    </main>
  );
}
