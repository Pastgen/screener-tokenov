"use client";

import { useEffect, useMemo, useState } from "react";
import "./style.css";

const formatUsd = (value) => {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 1_000) return `$${Math.round(n).toLocaleString("en-US")}`;
  return `$${n.toFixed(0)}`;
};

const formatFee = (fee) => `${(Number(fee || 0) * 100).toFixed(4).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")}%`;

export default function Home() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [query, setQuery] = useState("");
  const [onlyZeroFee, setOnlyZeroFee] = useState(false);
  const [minSize, setMinSize] = useState(0);
  const [sortKey, setSortKey] = useState("maxPositionUsd");
  const [sortDir, setSortDir] = useState("desc");
  const [copied, setCopied] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mexc", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "MEXC API error");
      setCoins(json.data || []);
      setUpdatedAt(json.updatedAt || new Date().toISOString());
    } catch (e) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coins
      .filter((c) => !q || c.symbol.toLowerCase().includes(q))
      .filter((c) => !onlyZeroFee || c.isZeroFee)
      .filter((c) => Number(c.maxPositionUsd || 0) >= Number(minSize || 0))
      .sort((a, b) => {
        const av = a[sortKey] ?? 0;
        const bv = b[sortKey] ?? 0;
        const result = typeof av === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
        return sortDir === "asc" ? result : -result;
      });
  }, [coins, query, onlyZeroFee, minSize, sortKey, sortDir]);

  function setSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  async function copySymbol(symbol) {
    await navigator.clipboard.writeText(symbol);
    setCopied(symbol);
    setTimeout(() => setCopied(""), 900);
  }

  const lastUpdate = updatedAt ? new Date(updatedAt).toLocaleString("ru-RU") : "—";

  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">MEXC Futures Scanner</div>
          <h1>Лимиты позиции, плечо и 0 fee</h1>
          <p>
            Практичный сканер без risk tiers: показывает публичный max size, max leverage, комиссии и цену. Тикер копируется кликом.
          </p>
          <span className="updated">Updated: {lastUpdate}</span>
        </div>
        <button className="refresh" onClick={loadData} disabled={loading}>{loading ? "Обновляю..." : "Обновить"}</button>
      </section>

      <section className="filters">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск: BTC, TIA, PEPE..." />
        <input value={minSize || ""} onChange={(e) => setMinSize(e.target.value)} placeholder="Мин. size $, например 50000" type="number" />
        <label className="check"><input type="checkbox" checked={onlyZeroFee} onChange={(e) => setOnlyZeroFee(e.target.checked)} /> Только 0 fee</label>
        <button className={sortKey === "maxPositionUsd" ? "sort active" : "sort"} onClick={() => setSort("maxPositionUsd")}>Max size {sortKey === "maxPositionUsd" ? (sortDir === "desc" ? "↓" : "↑") : ""}</button>
        <button className={sortKey === "maxLeverage" ? "sort active" : "sort"} onClick={() => setSort("maxLeverage")}>Max leverage {sortKey === "maxLeverage" ? (sortDir === "desc" ? "↓" : "↑") : ""}</button>
      </section>

      {error ? <div className="error">{error}</div> : null}
      {copied ? <div className="toast">Скопировано: {copied}</div> : null}

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
              <th>Max contracts</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.symbol}>
                <td><button className="symbol" onClick={() => copySymbol(c.symbol)} title="Скопировать тикер">{c.symbol}</button></td>
                <td className="money">{formatUsd(c.maxPositionUsd)}</td>
                <td>{c.maxLeverage}x</td>
                <td><span className={c.isZeroFee ? "pill yes" : "pill no"}>{c.isZeroFee ? "YES" : "NO"}</span></td>
                <td>{formatFee(c.makerFee)} / {formatFee(c.takerFee)}</td>
                <td>{Number(c.price).toPrecision(7)}</td>
                <td>{Math.round(c.maxVol).toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length ? <div className="empty">Ничего не найдено</div> : null}
      </section>
    </main>
  );
}
