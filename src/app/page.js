"use client";

import { useEffect, useMemo, useState } from "react";

const usdFull = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function formatUsd(value) {
  return `$${usdFull.format(Math.round(Number(value || 0)))}`;
}

function formatPrice(value) {
  const n = Number(value || 0);
  if (n === 0) return "0";
  if (n < 0.0001) return n.toPrecision(6);
  if (n < 1) return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  if (n < 100) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatFee(value) {
  const n = Number(value || 0);
  if (n === 0) return "0%";
  const pct = Math.abs(n) < 1 ? n * 100 : n;
  return `${pct.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU");
  } catch {
    return "—";
  }
}

export default function Home() {
  const [rows, setRows] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [onlyZero, setOnlyZero] = useState(false);
  const [sortKey, setSortKey] = useState("maxSizeUsd");
  const [sortDir, setSortDir] = useState("desc");
  const [copied, setCopied] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mexc", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.message || "Ошибка загрузки");
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setUpdatedAt(data.updatedAt);
    } catch (e) {
      setError(e?.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows
      .filter((r) => !q || r.symbol.toLowerCase().includes(q))
      .filter((r) => (onlyZero ? r.isZeroFee : true));

    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const result = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? result : -result;
    });
  }, [rows, search, onlyZero, sortKey, sortDir]);

  function setSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  async function copySymbol(symbol) {
    try {
      await navigator.clipboard.writeText(symbol);
      setCopied(symbol);
      setTimeout(() => setCopied(""), 1200);
    } catch {
      setCopied("");
    }
  }

  return (
    <main className="page">
      <section className="header">
        <div>
          <div className="kicker">MEXC Futures Scanner</div>
          <h1>Лимиты, плечо и 0 fee</h1>
          <p>
            Сканер показывает общий публичный max size из MEXC Futures API, отдельно max leverage и комиссии. Max size не привязывается к конкретному плечу.
          </p>
          <span className="updated">Updated: {formatTime(updatedAt)}</span>
        </div>
        <button className="refresh" onClick={load} disabled={loading}>
          {loading ? "Обновляю..." : "Обновить"}
        </button>
      </section>

      <section className="toolbar">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск: BTC, TIA, PEPE..." />
        <label className="check">
          <input type="checkbox" checked={onlyZero} onChange={(e) => setOnlyZero(e.target.checked)} />
          Только 0 fee
        </label>
        <button className={sortKey === "maxSizeUsd" ? "pill active" : "pill"} onClick={() => setSort("maxSizeUsd")}>
          Max size {sortKey === "maxSizeUsd" ? (sortDir === "desc" ? "↓" : "↑") : ""}
        </button>
        <button className={sortKey === "maxLeverage" ? "pill active" : "pill"} onClick={() => setSort("maxLeverage")}>
          Max leverage {sortKey === "maxLeverage" ? (sortDir === "desc" ? "↓" : "↑") : ""}
        </button>
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
              <th>Max vol</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.symbol}>
                <td>
                  <button className="symbol" onClick={() => copySymbol(r.symbol)} title="Нажми, чтобы скопировать">
                    {r.symbol}
                  </button>
                </td>
                <td className="money">{formatUsd(r.maxSizeUsd)}</td>
                <td>{r.maxLeverage ? `${r.maxLeverage}x` : "—"}</td>
                <td><span className={r.isZeroFee ? "yes" : "no"}>{r.isZeroFee ? "YES" : "NO"}</span></td>
                <td>{formatFee(r.makerFee)} / {formatFee(r.takerFee)}</td>
                <td>{formatPrice(r.price)}</td>
                <td>{usdFull.format(Math.round(Number(r.maxVol || 0)))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && filtered.length === 0 ? <div className="empty">Ничего не найдено</div> : null}
      </section>

      <section className="note">
        <b>Важно:</b> Max size — общий лимит из публичного contract/detail. Он не означает, что весь size доступен на максимальном плече. Risk tiers убраны, чтобы сайт не показывал ложную привязку плеча к сайзу.
      </section>
    </main>
  );
}
