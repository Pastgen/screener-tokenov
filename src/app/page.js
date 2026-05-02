"use client";

import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const MARKET_TABS = ["ALL", "USDT-M", "USDC-M", "USD1-M", "USD-M", "COIN-M"];
const SORTABLE = new Set(["symbol", "maxSizeUsd", "contracts", "maxLeverage", "makerTaker", "price", "marketType"]);

function formatUsd(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString("en-US")}`;
}

function formatNumber(value) {
  const n = Number(value || 0);
  if (n >= 1_000_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1_000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 }).replace(/\.0+$/, "");
}

function formatPrice(value) {
  const n = Number(value || 0);
  if (n >= 100) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumSignificantDigits: 8 });
}

function formatFee(value) {
  const n = Number(value || 0) * 100;
  if (Math.abs(n) < 0.000001) return "0%";
  return `${n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function nextSort(current, key) {
  if (current.key !== key) return { key, dir: "desc" };
  if (current.dir === "desc") return { key, dir: "asc" };
  return { key: "", dir: "none" };
}

function SortLabel({ label, column, sort, setSort, align = "left" }) {
  const active = sort.key === column && sort.dir !== "none";
  const arrow = active ? (sort.dir === "desc" ? "↓" : "↑") : "";
  return (
    <button
      className={`sortHead ${active ? "active" : ""} ${align === "right" ? "right" : ""}`}
      onClick={() => setSort((s) => nextSort(s, column))}
      title="Нажми: убывание → возрастание → без сортировки"
    >
      <span>{label}</span>
      <span className="arrow">{arrow}</span>
    </button>
  );
}

export default function Home() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("ALL");
  const [onlyZeroFee, setOnlyZeroFee] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [minSize, setMinSize] = useState("");
  const [minLev, setMinLev] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [copied, setCopied] = useState("");
  const [sort, setSort] = useState({ key: "maxSizeUsd", dir: "desc" });

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mexc", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to load data");
      setCoins(Array.isArray(data.coins) ? data.coins : []);
      setUpdatedAt(data.updatedAt || new Date().toISOString());
    } catch (e) {
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    try {
      const stored = JSON.parse(localStorage.getItem("mexcScannerFavorites") || "[]");
      if (Array.isArray(stored)) setFavorites(stored);
    } catch {}
  }, []);

  function saveFavorites(next) {
    setFavorites(next);
    localStorage.setItem("mexcScannerFavorites", JSON.stringify(next));
  }

  function toggleFavorite(symbol) {
    const next = favorites.includes(symbol)
      ? favorites.filter((s) => s !== symbol)
      : [...favorites, symbol];
    saveFavorites(next);
  }

  async function copySymbol(symbol) {
    try {
      await navigator.clipboard.writeText(symbol);
      setCopied(`${symbol} copied`);
      setTimeout(() => setCopied(""), 1200);
    } catch {
      setCopied("Copy failed");
      setTimeout(() => setCopied(""), 1200);
    }
  }

  const marketsAvailable = useMemo(() => {
    const set = new Set(coins.map((c) => c.marketType).filter(Boolean));
    return MARKET_TABS.filter((tab) => tab === "ALL" || set.has(tab));
  }, [coins]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minSizeValue = Number(String(minSize).replace(/[^0-9.]/g, "")) || 0;
    const minLevValue = Number(String(minLev).replace(/[^0-9.]/g, "")) || 0;

    const list = coins
      .filter((coin) => market === "ALL" || coin.marketType === market)
      .filter((coin) => !q || coin.symbol.toLowerCase().includes(q) || coin.displaySymbol?.toLowerCase().includes(q))
      .filter((coin) => !onlyZeroFee || coin.isZeroFee)
      .filter((coin) => !favoritesOnly || favorites.includes(coin.symbol))
      .filter((coin) => !minSizeValue || Number(coin.maxSizeUsd) >= minSizeValue)
      .filter((coin) => !minLevValue || Number(coin.maxLeverage) >= minLevValue);

    if (!sort.key || sort.dir === "none" || !SORTABLE.has(sort.key)) return list;

    const direction = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let av;
      let bv;
      if (sort.key === "makerTaker") {
        av = Number(a.makerFee) + Number(a.takerFee);
        bv = Number(b.makerFee) + Number(b.takerFee);
      } else if (sort.key === "symbol" || sort.key === "marketType") {
        return String(a[sort.key] || "").localeCompare(String(b[sort.key] || "")) * direction;
      } else {
        av = Number(a[sort.key] || 0);
        bv = Number(b[sort.key] || 0);
      }
      return (av - bv) * direction;
    });
  }, [coins, query, market, onlyZeroFee, favoritesOnly, favorites, minSize, minLev, sort]);

  const stats = useMemo(() => {
    const zero = coins.filter((c) => c.isZeroFee).length;
    const fav = favorites.length;
    return { total: coins.length, zero, fav };
  }, [coins, favorites]);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="kicker">MEXC Futures Scanner</div>
          <h1>Лимиты позиции и 0 fee</h1>
          <p>Max size показывает общий максимальный размер позиции в $, отдельно от max leverage. Тикер копируется кликом.</p>
          <div className="meta">
            <span>{stats.total} contracts</span>
            <span>{stats.zero} zero-fee</span>
            <span>{stats.fav} favorites</span>
            {updatedAt && <span>Updated: {new Date(updatedAt).toLocaleString("ru-RU")}</span>}
          </div>
        </div>
        <button className="refresh" onClick={loadData} disabled={loading}>{loading ? "Обновляю..." : "Обновить"}</button>
      </section>

      <section className="panel filters">
        <input
          className="search"
          placeholder="Search: BTC, TIA, PEPE..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="tabs">
          {marketsAvailable.map((tab) => (
            <button key={tab} className={market === tab ? "tab active" : "tab"} onClick={() => setMarket(tab)}>{tab}</button>
          ))}
        </div>

        <div className="miniFilters">
          <label className="check"><input type="checkbox" checked={onlyZeroFee} onChange={(e) => setOnlyZeroFee(e.target.checked)} /> 0 fee</label>
          <label className="check"><input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} /> Favorites</label>
          <input className="smallInput" placeholder="Min size $" value={minSize} onChange={(e) => setMinSize(e.target.value)} />
          <input className="smallInput" placeholder="Min lev" value={minLev} onChange={(e) => setMinLev(e.target.value)} />
        </div>
      </section>

      {error && <div className="error">{error}</div>}
      {copied && <div className="toast">{copied}</div>}

      <section className="tableWrap">
        <table>
          <thead>
            <tr>
              <th><SortLabel label="Symbol" column="symbol" sort={sort} setSort={setSort} /></th>
              <th><SortLabel label="Market" column="marketType" sort={sort} setSort={setSort} /></th>
              <th className="num"><SortLabel label="Max size $" column="maxSizeUsd" sort={sort} setSort={setSort} align="right" /></th>
              <th className="num"><SortLabel label="Contracts" column="contracts" sort={sort} setSort={setSort} align="right" /></th>
              <th className="num"><SortLabel label="Max leverage" column="maxLeverage" sort={sort} setSort={setSort} align="right" /></th>
              <th>0 fee</th>
              <th className="num"><SortLabel label="Maker / Taker" column="makerTaker" sort={sort} setSort={setSort} align="right" /></th>
              <th className="num"><SortLabel label="Price" column="price" sort={sort} setSort={setSort} align="right" /></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((coin) => {
              const fav = favorites.includes(coin.symbol);
              return (
                <tr key={coin.symbol}>
                  <td className="symbolCell">
                    <button className={fav ? "star active" : "star"} onClick={() => toggleFavorite(coin.symbol)} title="Add to favorites">{fav ? "★" : "☆"}</button>
                    <button className="symbolBtn" onClick={() => copySymbol(coin.symbol)} title="Copy symbol">{coin.symbol}</button>
                  </td>
                  <td><span className="marketBadge">{coin.marketType}</span></td>
                  <td className="num money">{formatUsd(coin.maxSizeUsd)}</td>
                  <td className="num">{formatNumber(coin.contracts)}</td>
                  <td className="num strong">{formatNumber(coin.maxLeverage)}x</td>
                  <td><span className={coin.isZeroFee ? "pill yes" : "pill no"}>{coin.isZeroFee ? "YES" : "NO"}</span></td>
                  <td className="num">{formatFee(coin.makerFee)} / {formatFee(coin.takerFee)}</td>
                  <td className="num">{formatPrice(coin.price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && <div className="empty">Ничего не найдено. Ослабь фильтры.</div>}
      </section>
    </main>
  );
}
