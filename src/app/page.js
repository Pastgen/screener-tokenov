'use client';

import { useEffect, useMemo, useState } from 'react';

function money(n) {
  return '$' + Math.round(Number(n || 0)).toLocaleString('en-US');
}

export default function Home() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [onlyZeroFee, setOnlyZeroFee] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const [opened, setOpened] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/mexc', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to load');
      setCoins(data);
    } catch (e) {
      setError(e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...coins]
      .filter(c => !q || c.symbol.toLowerCase().includes(q))
      .filter(c => !onlyZeroFee || c.isZeroFee)
      .sort((a, b) => sortDesc ? b.maxPositionUsd - a.maxPositionUsd : a.maxPositionUsd - b.maxPositionUsd);
  }, [coins, search, onlyZeroFee, sortDesc]);

  return (
    <main style={{ minHeight: '100vh', background: '#080b12', color: '#e8eefc', padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end', marginBottom: 20 }}>
          <div>
            <div style={{ color: '#69e3ff', fontSize: 13, fontWeight: 700 }}>MEXC Futures Scanner</div>
            <h1 style={{ margin: '6px 0 0', fontSize: 34 }}>Лимиты позиций и 0 fee</h1>
            <p style={{ color: '#8c99ad', marginTop: 8 }}>Сортировка по максимальному доступному $-лимиту позиции. Данные обновляются с публичного MEXC Futures API.</p>
          </div>
          <button onClick={load} style={btn}>Обновить</button>
        </div>

        <section style={card}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск: BTC, PEPE, SOL..." style={input} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={onlyZeroFee} onChange={e => setOnlyZeroFee(e.target.checked)} /> Только 0 fee
          </label>
          <button onClick={() => setSortDesc(v => !v)} style={btn}>Max position {sortDesc ? '↓' : '↑'}</button>
        </section>

        {loading && <div style={msg}>Загрузка...</div>}
        {error && <div style={{...msg, color:'#ff6b6b'}}>Ошибка: {error}</div>}

        {!loading && !error && (
          <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead style={{ background: '#0d1320', color: '#9fb0c8' }}>
                  <tr>
                    <th style={th}>Symbol</th>
                    <th style={th}>Max position $</th>
                    <th style={th}>Max leverage</th>
                    <th style={th}>0 fee</th>
                    <th style={th}>Maker / Taker</th>
                    <th style={th}>Price</th>
                    <th style={th}>Risk levels</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(c => (
                    <>
                      <tr key={c.symbol} style={{ borderTop: '1px solid #1d2636' }}>
                        <td style={td}><b>{c.symbol}</b></td>
                        <td style={{...td, color:'#70f0b2', fontWeight:800}}>{money(c.maxPositionUsd)}</td>
                        <td style={td}>{c.maxLeverage}x</td>
                        <td style={td}><span style={pill(c.isZeroFee)}>{c.isZeroFee ? 'YES' : 'NO'}</span></td>
                        <td style={td}>{c.makerFee} / {c.takerFee}</td>
                        <td style={td}>{c.price}</td>
                        <td style={td}><button style={smallBtn} onClick={() => setOpened(opened === c.symbol ? null : c.symbol)}>{opened === c.symbol ? 'Скрыть' : 'Открыть'}</button></td>
                      </tr>
                      {opened === c.symbol && (
                        <tr>
                          <td colSpan="7" style={{ padding: 14, background: '#0b101b', color: '#aebbd0' }}>
                            <div><b>Сейчас:</b> публичный API MEXC отдаёт базовый maxVol/maxLeverage. Полные risk tiers по плечам добавим отдельным источником/парсером, если endpoint будет доступен.</div>
                            <div style={{ marginTop: 8 }}>Формула: maxVol × contractSize × price = {c.maxVol} × {c.contractSize} × {c.price} = <b>{money(c.maxPositionUsd)}</b></div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

const card = { background: '#111722', border: '1px solid #202b3c', borderRadius: 16, padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' };
const btn = { background: '#18c58b', color: '#06120d', border: 0, padding: '11px 16px', borderRadius: 12, fontWeight: 800, cursor: 'pointer' };
const smallBtn = { background: '#192235', color: '#dce8ff', border: '1px solid #2a3850', padding: '7px 10px', borderRadius: 10, cursor: 'pointer' };
const input = { background: '#080b12', color: '#e8eefc', border: '1px solid #2a3850', padding: '12px 14px', borderRadius: 12, minWidth: 280, outline: 'none' };
const th = { textAlign: 'left', padding: 14, fontSize: 13 };
const td = { padding: 14 };
const msg = { background:'#111722', border:'1px solid #202b3c', borderRadius:16, padding:18 };
const pill = ok => ({ background: ok ? '#123d2d' : '#3a1820', color: ok ? '#70f0b2' : '#ff8899', padding:'5px 10px', borderRadius:999, fontWeight:800, fontSize:12 });
