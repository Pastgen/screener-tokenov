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
              <th>Max leverage</th>
              <th>0 fee</th>
              <th>Maker / Taker</th>
              <th>Price</th>
              <th>Max vol</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.symbol}>
                <td><button className="symbol" onClick={() => copySymbol(r.symbol)} title="Click to copy">{r.symbol}</button></td>
                <td className="money">{usd(r.maxSizeUsd)}</td>
                <td>{r.maxLeverage}x</td>
                <td><span className={r.isZeroFee ? "yes" : "no"}>{r.isZeroFee ? "YES" : "NO"}</span></td>
                <td>{feePct(r.makerFee)} / {feePct(r.takerFee)}</td>
                <td>{Number(r.price).toLocaleString("en-US", { maximumSignificantDigits: 10 })}</td>
                <td>{num(r.overallMaxContracts)}</td>
                <td className="source">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <style jsx>{`
        * { box-sizing: border-box; }
        .page { min-height: 100vh; background: #080d15; color: #eef5ff; padding: 48px 20px; font-family: Inter, Arial, sans-serif; }
        .header, .panel, .tableWrap { max-width: 1180px; margin: 0 auto; }
        .header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
        .tag { color: #22e6c2; font-weight: 800; margin: 0 0 6px; }
        h1 { margin: 0; font-size: 34px; letter-spacing: -0.04em; }
        .sub { color: #a9b9d6; margin: 10px 0 0; max-width: 820px; }
        .updated { color: #9db0d0; font-size: 13px; }
        .refresh, .filters button { border: 0; border-radius: 14px; font-weight: 900; padding: 14px 22px; cursor: pointer; }
        .refresh, .filters button.active { background: #20d09f; color: #051017; }
        .filters button { background: #112448; color: #eef5ff; border: 1px solid #254675; }
        .panel { background: #101926; border: 1px solid #223753; border-radius: 20px; padding: 16px; display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
        input { background: #08111f; border: 1px solid #2d476b; color: white; border-radius: 14px; padding: 14px 18px; min-width: 280px; outline: none; }
        .check { display: flex; align-items: center; gap: 10px; color: #e8f1ff; font-weight: 800; }
        .tableWrap { overflow: auto; border: 1px solid #223753; border-radius: 16px; background: #101926; }
        table { width: 100%; border-collapse: collapse; min-width: 980px; }
        th { color: #78b7ff; font-size: 14px; text-align: left; padding: 16px; background: #111d2d; border-bottom: 1px solid #263a58; }
        td { padding: 18px 16px; border-bottom: 1px solid #22334d; font-weight: 700; }
        .money { color: #29f0ad; font-size: 18px; font-weight: 1000; }
        .symbol { background: transparent; color: white; border: 0; font: inherit; font-weight: 1000; cursor: pointer; padding: 0; }
        .symbol:hover { color: #20d09f; }
        .yes, .no { border-radius: 999px; padding: 8px 12px; font-size: 13px; font-weight: 1000; display: inline-block; }
        .yes { color: #9fffd6; background: rgba(20, 185, 120, .42); }
        .no { color: #ffb4c3; background: rgba(220, 40, 80, .28); }
        .source { color: #8da2c4; font-size: 13px; }
        .err { max-width: 1180px; margin: 0 auto 16px; color: #ffbac7; background: #35111b; border: 1px solid #7b2235; padding: 12px; border-radius: 12px; }
        .toast { position: fixed; right: 24px; bottom: 24px; background: #20d09f; color: #071016; padding: 13px 18px; border-radius: 14px; font-weight: 1000; }
        @media (max-width: 820px) { .header, .panel { flex-direction: column; align-items: stretch; } input { min-width: 0; width: 100%; } }
      `}</style>
    </main>
  );
}
