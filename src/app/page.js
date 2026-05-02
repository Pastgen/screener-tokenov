"use client";

import { useEffect, useMemo, useState } from 'react';
import './globals.css';

const MARKETS = ['ALL', 'USDT-M', 'USDC-M', 'USD1-M', 'USD-M', 'COIN-M'];
const FAVORITES_KEY = 'mexc-scanner-favorites-v1';

function formatUsd(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString('en-US')}`;
}

function formatNumber(value, maximumFractionDigits = 0) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits });
}

function formatPrice(value) {
  const n = Number(value || 0);
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { maximumSignificantDigits: 8 });
}

function formatFee(value) {
  const n = Number(value || 0);
  if (n === 0) return '0%';
  return `${n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

function parseMoneyInput(value) {
  if (!value) return 0;
  const cleaned = String(value).replace(/[$,\s]/g, '').toLowerCase();
  const multiplier = cleaned.endsWith('m') ? 1_000_000 : cleaned.endsWith('k') ? 1_000 : 1;
  return Number(cleaned.replace(/[mk]$/, '')) * multiplier || 0;
}

export default function Home() {
  const [coins, setCoins] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('ALL');
  const [zeroOnly, setZeroOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [minSize, setMinSize] = useState('');
  const [minLeverage, setMinLeverage] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [sort, setSort] = useState({ key: 'maxSizeUsd', dir: 'desc' });
  const [toast, setToast] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      if (Array.isArray(saved)) setFavorites(saved);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mexc', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to load data');
      setCoins(json.data || []);
      setUpdatedAt(json.updatedAt || new Date().toISOString());
    } catch (err) {
      setError(err?.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function copySymbol(symbol) {
    navigator.clipboard?.writeText(symbol);
    setToast(`${symbol} copied`);
    window.setTimeout(() => setToast(''), 1200);
  }

  function toggleFavorite(symbol) {
    setFavorites((prev) => prev.includes(symbol) ? prev.filter((x) => x !== symbol) : [...prev, symbol]);
  }

  function toggleFavoritesOnly() {
    setFavoritesOnly((value) => !value);
  }

  function sortBy(key) {
    setSort((current) => {
      if (current.key !== key) return { key, dir: 'desc' };
      if (current.dir === 'desc') return { key, dir: 'asc' };
      return { key: 'maxSizeUsd', dir: 'desc' };
    });
  }

  function sortArrow(key) {
    if (sort.key !== key) return '';
    return sort.dir === 'desc' ? ' ↓' : ' ↑';
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minUsd = parseMoneyInput(minSize);
    const minLev = Number(minLeverage || 0);
    const favSet = new Set(favorites);

    const list = coins
      .filter((coin) => !q || coin.symbol.toLowerCase().includes(q))
      .filter((coin) => market === 'ALL' || coin.market === market)
      .filter((coin) => !zeroOnly || coin.zeroFee)
      .filter((coin) => !favoritesOnly || favSet.has(coin.symbol))
      .filter((coin) => !minUsd || coin.maxSizeUsd >= minUsd)
      .filter((coin) => !minLev || coin.maxLeverage >= minLev);

    const sorted = [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const res = typeof av === 'string' ? av.localeCompare(bv) : Number(av || 0) - Number(bv || 0);
      return sort.dir === 'asc' ? res : -res;
    });

    return sorted;
  }, [coins, query, market, zeroOnly, favoritesOnly, minSize, minLeverage, favorites, sort]);

  return (
    <main className="page">
      <section className="topbar">
        <div>
          <div className="eyebrow">MEXC Futures Scanner</div>
          <h1>Лимиты позиции и 0 fee</h1>
          <p className="subtitle">Max size показывает общий максимальный размер позиции в $, отдельно от max leverage. Тикер копируется кликом. Звезда в заголовке включает фильтр по избранным.</p>
          <div className="meta">
            <span className="pill">{coins.length} contracts</span>
            <span className="pill">{coins.filter((c) => c.zeroFee).length} zero-fee</span>
            <span className="pill">{favorites.length} favorites</span>
            <span className="pill">Updated: {updatedAt ? new Date(updatedAt).toLocaleString('ru-RU') : '—'}</span>
          </div>
        </div>
        <button className="refresh" onClick={loadData} disabled={loading}>{loading ? 'Обновляю...' : 'Обновить'}</button>
      </section>

      {error ? <div className="error">Ошибка: {error}</div> : null}

      <section className="controls">
        <div className="controls-row">
          <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: BTC, TIA, PEPE..." />
          <div className="tabs">
            {MARKETS.map((item) => (
              <button key={item} className={`tab ${market === item ? 'active' : ''}`} onClick={() => setMarket(item)}>{item}</button>
            ))}
          </div>
          <div className="spacer" />
          <button className={`zero-button ${zeroOnly ? 'active' : ''}`} onClick={() => setZeroOnly((v) => !v)}>0 fee</button>
        </div>
        <div className="controls-row">
          <label className="filter-group">Size ≥ <input className="filter-input" value={minSize} onChange={(e) => setMinSize(e.target.value)} placeholder="1m / 500k" /></label>
          <label className="filter-group">Leverage ≥ <input className="filter-input" value={minLeverage} onChange={(e) => setMinLeverage(e.target.value)} placeholder="100" /></label>
        </div>
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <button
                  className={`header-star ${favoritesOnly ? 'active' : ''}`}
                  onClick={toggleFavoritesOnly}
                  title="Показать только избранные"
                >★</button>
              </th>
              <th className="sortable" onClick={() => sortBy('symbol')}>Symbol{sortArrow('symbol')}</th>
              <th className="sortable" onClick={() => sortBy('market')}>Market{sortArrow('market')}</th>
              <th className="sortable num" onClick={() => sortBy('maxSizeUsd')}>Max size ${sortArrow('maxSizeUsd')}</th>
              <th className="sortable num" onClick={() => sortBy('contracts')}>Contracts{sortArrow('contracts')}</th>
              <th className="sortable num" onClick={() => sortBy('maxLeverage')}>Max leverage{sortArrow('maxLeverage')}</th>
              <th className="sortable" onClick={() => sortBy('zeroFee')}>0 fee{sortArrow('zeroFee')}</th>
              <th>Maker / Taker</th>
              <th className="sortable num" onClick={() => sortBy('price')}>Price{sortArrow('price')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((coin) => {
              const isFav = favorites.includes(coin.symbol);
              return (
                <tr key={coin.symbol}>
                  <td style={{ width: 44 }}>
                    <button
                      className={`star-button ${isFav ? 'active' : ''}`}
                      onClick={() => toggleFavorite(coin.symbol)}
                      title={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
                    >★</button>
                  </td>
                  <td><span className="symbol" onClick={() => copySymbol(coin.symbol)}>{coin.symbol}</span></td>
                  <td><span className="market-badge">{coin.market}</span></td>
                  <td className="num size">{formatUsd(coin.maxSizeUsd)}</td>
                  <td className="num">{formatNumber(coin.contracts)}</td>
                  <td className="num">{formatNumber(coin.maxLeverage)}x</td>
                  <td><span className={`fee-badge ${coin.zeroFee ? 'fee-yes' : 'fee-no'}`}>{coin.zeroFee ? 'YES' : 'NO'}</span></td>
                  <td>{formatFee(coin.makerFee)} / {formatFee(coin.takerFee)}</td>
                  <td className="num">{formatPrice(coin.price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length ? <div className="empty">Ничего не найдено. Ослабь фильтры.</div> : null}
      </section>
      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}
