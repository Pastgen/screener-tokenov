'use client';

import { useEffect, useMemo, useState } from 'react';

const fmtUsd = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n || 0));
const fmtNum = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(Number(n || 0));
const fmtPct = (n) => `${(Number(n || 0) * 100).toFixed(4)}%`;

export default function Home() {
  const [rows, setRows] = useState([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [onlyZeroFee, setOnlyZeroFee] = useState(false);
  const [sortKey, setSortKey] = useState('maxPositionUsd');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mexc', { cache: 'no-store' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Unknown API error');
      setRows(data.rows || []);
      setUpdatedAt(data.updatedAt || '');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...rows]
      .filter((r) => !q || r.symbol.toLowerCase().includes(q) || r.displaySymbol.toLowerCase().includes(q))
      .filter((r) => !onlyZeroFee || r.isZeroFee)
      .sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const res = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? res : -res;
      });
  }, [rows, search, onlyZeroFee, sortKey, sortDir]);

  function sortBy(key) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MEXC Futures Scanner</h1>
            <p className="mt-2 text-sm text-slate-400">Сортировка фьючерсных монет по максимальному доступному размеру позиции в $.</p>
          </div>
          <button onClick={loadData} className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400">
            {loading ? 'Обновляю...' : 'Обновить данные'}
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm text-slate-400">Монет в базе</div>
            <div className="mt-1 text-2xl font-bold">{rows.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm text-slate-400">0 fee</div>
            <div className="mt-1 text-2xl font-bold">{rows.filter(r => r.isZeroFee).length}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm text-slate-400">Топ лимит</div>
            <div className="mt-1 text-2xl font-bold">{fmtUsd(rows[0]?.maxPositionUsd)}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm text-slate-400">Обновлено</div>
            <div className="mt-1 text-sm font-semibold">{updatedAt ? new Date(updatedAt).toLocaleString() : '—'}</div>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:flex-row md:items-center">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск: BTC, PEPE, SIREN..." className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-400 md:max-w-md" />
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyZeroFee} onChange={(e) => setOnlyZeroFee(e.target.checked)} />
            Только 0 fee
          </label>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-900 bg-red-950/50 p-4 text-red-200">Ошибка: {error}</div>}

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-slate-950 text-slate-300">
                <tr>
                  <th className="p-3">Symbol</th>
                  <th className="p-3"><button onClick={() => sortBy('maxPositionUsd')} className="hover:text-white">Max position $ ↕</button></th>
                  <th className="p-3"><button onClick={() => sortBy('maxLeverage')} className="hover:text-white">Max lev ↕</button></th>
                  <th className="p-3">0 fee</th>
                  <th className="p-3">Maker / Taker</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Risk levels</th>
                  <th className="p-3">API</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <>
                    <tr key={r.symbol} onClick={() => setExpanded(expanded === r.symbol ? null : r.symbol)} className="cursor-pointer border-t border-slate-800 hover:bg-slate-800/70">
                      <td className="p-3 font-bold text-white">{r.symbol}</td>
                      <td className="p-3 font-semibold text-cyan-200">{fmtUsd(r.maxPositionUsd)}</td>
                      <td className="p-3">{r.maxLeverage}x</td>
                      <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${r.isZeroFee ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>{r.isZeroFee ? 'YES' : 'NO'}</span></td>
                      <td className="p-3">{fmtPct(r.makerFee)} / {fmtPct(r.takerFee)}</td>
                      <td className="p-3">{fmtNum(r.price)}</td>
                      <td className="p-3">{r.riskLevelLimit || '—'}</td>
                      <td className="p-3">{r.apiAllowed ? 'ON' : 'OFF'}</td>
                    </tr>
                    {expanded === r.symbol && (
                      <tr className="border-t border-slate-800 bg-slate-950/60">
                        <td colSpan="8" className="p-4 text-slate-300">
                          <div className="grid gap-2 md:grid-cols-4">
                            <div><span className="text-slate-500">MaxVol:</span> {fmtNum(r.maxVol)}</div>
                            <div><span className="text-slate-500">Contract size:</span> {fmtNum(r.contractSize)}</div>
                            <div><span className="text-slate-500">Risk limit type:</span> {r.riskLimitType}</div>
                            <div><span className="text-slate-500">Formula:</span> maxVol × contractSize × price</div>
                          </div>
                          <div className="mt-3 rounded-xl border border-amber-900 bg-amber-950/30 p-3 text-amber-100">
                            Все risk-tier уровни по плечам требуют отдельного источника: private endpoint MEXC или парсинг публичной страницы Risk Limit. Эта версия уже показывает лучший публичный лимит из contract/detail.
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
