"use client";

import { useEffect, useMemo, useState } from "react";
import "./style.css";

const fmtUsd = (n) => {
  if (!Number.isFinite(Number(n))) return "—";
  return "$" + Math.round(Number(n)).toLocaleString("en-US");
};
const fmtNum = (n, max = 6) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: max });
const fmtFee = (n) => (Number(n) * 100).toFixed(Number(n) === 0 ? 0 : 4).replace(/\.0+$/, "") + "%";

export default function Home() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [zeroOnly, setZeroOnly] = useState(false);
  const [sortKey, setSortKey] = useState("bestMaxPositionUsd");
  const [sortDir, setSortDir] = useState("desc");
  const [open, setOpen] = useState({});
  const [updatedAt, setUpdatedAt] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mexc", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "API error");
      setCoins(json.data || []);
      setUpdatedAt(json.updatedAt);
    } catch (e) {
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = coins
      .filter((c) => !q || c.symbol.toLowerCase().includes(q))
      .filter((c) => !zeroOnly || c.isZeroFee);

    filtered.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const result = typeof av === "string" ? av.localeCompare(bv) : Number(av || 0) - Number(bv || 0);
      return sortDir === "asc" ? result : -result;
    });
    return filtered;
  }, [coins, search, zeroOnly, sortKey, sortDir]);

  function sortBy(key) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">MEXC Futures Scanner</div>
          <h1>Risk tiers, лимиты позиций и 0 fee</h1>
          <p>Главная колонка считает самый большой доступный лимит среди всех risk tiers, а не только лимит на максимальном плече.</p>
          {updatedAt && <p className="muted">Обновлено: {new Date(updatedAt).toLocaleString()}</p>}
        </div>
        <button className="refresh" onClick={load} disabled={loading}>{loading ? "Загрузка..." : "Обновить"}</button>
      </section>

      <section className="panel filters">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск: TIA, BTC, PEPE..." />
        <label><input type="checkbox" checked={zeroOnly} onChange={(e) => setZeroOnly(e.target.checked)} /> Только 0 fee</label>
        <button className="sort" onClick={() => sortBy("bestMaxPositionUsd")}>Max position {sortKey === "bestMaxPositionUsd" ? (sortDir === "desc" ? "↓" : "↑") : ""}</button>
        <button className="sort ghost" onClick={() => sortBy("highestLeverage")}>Max leverage</button>
      </section>

      {error && <div className="error">Ошибка: {error}</div>}

      <section className="tableWrap">
        <table>
          <thead>
            <tr>
              <th onClick={() => sortBy("symbol")}>Symbol</th>
              <th onClick={() => sortBy("bestMaxPositionUsd")}>Best max position $</th>
              <th>Best tier</th>
              <th>Highest lev. tier</th>
              <th>0 fee</th>
              <th>Maker / Taker</th>
              <th>Price</th>
              <th>Risk levels</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <>
                <tr key={c.symbol}>
                  <td className="symbol">{c.symbol}</td>
                  <td className="money">{fmtUsd(c.bestMaxPositionUsd)}</td>
                  <td>{c.bestTierLeverage}x / tier {c.bestTierLevel}</td>
                  <td>{fmtUsd(c.highestLeveragePositionUsd)} @ {c.highestLeverage}x</td>
                  <td><span className={c.isZeroFee ? "pill yes" : "pill no"}>{c.isZeroFee ? "YES" : "NO"}</span></td>
                  <td>{fmtFee(c.makerFee)} / {fmtFee(c.takerFee)}</td>
                  <td>{fmtNum(c.price)}</td>
                  <td><button className="mini" onClick={() => setOpen((o) => ({ ...o, [c.symbol]: !o[c.symbol] }))}>{open[c.symbol] ? "Скрыть" : "Открыть"}</button></td>
                </tr>
                {open[c.symbol] && (
                  <tr className="details" key={`${c.symbol}-details`}>
                    <td colSpan="8">
                      <div className="detailsBox">
                        <div className="detailsTitle">Все risk tiers для {c.symbol}</div>
                        <table className="tierTable">
                          <thead><tr><th>Tier</th><th>Contracts range</th><th>Position $ range</th><th>Max leverage</th><th>IMR</th><th>MMR</th></tr></thead>
                          <tbody>
                            {c.tiers.map((t) => (
                              <tr key={t.level}>
                                <td>{t.level}</td>
                                <td>{fmtNum(t.lowerVol, 0)} → {fmtNum(t.upperVol, 0)}</td>
                                <td>{fmtUsd(t.minPositionUsd)} → <b>{fmtUsd(t.maxPositionUsd)}</b></td>
                                <td>{t.maxLeverage}x</td>
                                <td>{fmtFee(t.initialMarginRate)}</td>
                                <td>{fmtFee(t.maintenanceMarginRate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="hint">Формула: contracts × contractSize × current price. Для BY_VOLUME risk limits это должно совпадать с таблицей MEXC с небольшой погрешностью из-за движения цены.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && <div className="empty">Ничего не найдено</div>}
      </section>
    </main>
  );
}
