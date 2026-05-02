use client';

import { useEffect, useMemo, useState } from 'react';

const fmtUsd = (n) => '$' + Math.round(Number(n || 0)).toLocaleString('en-US');
const fmtNum = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');
const fmtPct = (n) => (Number(n || 0) * 100).toFixed(4) + '%';
const feePct = (n) => (Number(n || 0) * 100).toFixed(Number(n) === 0 ? 0 : 4) + '%';

export default function Home() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [onlyZero, setOnlyZero] = useState(false);
  const [sort, setSort] = useState('position');
  const [open, setOpen] = useState({});
  const [updatedAt, setUpdatedAt] = useState('');
  const [copied, setCopied] = useState('');

  async function load() {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/mexc', { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'API error');
      setCoins(json.data || []);
      setUpdatedAt(json.updatedAt || '');
    } catch (e) { setErr(String(e.message || e)); }
    finally { setLoading(false); }
  }

  async function copySymbol(symbol) {
    try {
      await navigator.clipboard.writeText(symbol);
      setCopied(symbol);
      setTimeout(() => setCopied(''), 1200);
    } catch {
      setCopied('copy error');
      setTimeout(() => setCopied(''), 1200);
    }
  }

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const query = q.trim().toUpperCase();
    const arr = coins
      .filter(c => !query || c.symbol.includes(query))
      .filter(c => !onlyZero || c.isZeroFee);
    arr.sort((a,b) => {
      if (sort === 'lev') return (b.highestLevTier?.maxLeverage || 0) - (a.highestLevTier?.maxLeverage || 0);
      return (b.maxPositionUsd || 0) - (a.maxPositionUsd || 0);
    });
    return arr;
  }, [coins, q, onlyZero, sort]);

  return <main className="page">
    <section className="hero">
      <div>
        <div className="tag">MEXC Futures Scanner</div>
        <h1>Risk tiers: лимиты позиции и 0 fee</h1>
        <p>Лимиты строятся только из публичных полей MEXC: riskBaseVol, riskIncrVol, riskLevelLimit, IMR/MMR. Если у монеты один уровень — будет один tier. Если уровней несколько — таблица покажет каждый.</p>
        {updatedAt && <p className="small">Updated: {new Date(updatedAt).toLocaleString()}</p>}
      </div>
      <button className="refresh" onClick={load}>{loading ? 'Обновляю...' : 'Обновить'}</button>
    </section>

    <section className="filters">
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск: BTC, TIA, PEPE..." />
      <label><input type="checkbox" checked={onlyZero} onChange={e=>setOnlyZero(e.target.checked)} /> Только 0 fee</label>
      <button className={sort==='position'?'active':''} onClick={()=>setSort('position')}>Max position ↓</button>
      <button className={sort==='lev'?'active':''} onClick={()=>setSort('lev')}>Max leverage ↓</button>
      {copied && <span className="copied">Скопировано: {copied}</span>}
    </section>

    {err && <div className="error">Ошибка: {err}</div>}

    <section className="tableWrap">
      <table>
        <thead><tr>
          <th>Symbol</th><th>Best max position $</th><th>Best tier</th><th>Highest lev. tier</th><th>0 fee</th><th>Maker / Taker</th><th>Price</th><th>Risk levels</th>
        </tr></thead>
        <tbody>{rows.map(c => <>
          <tr key={c.symbol}>
            <td>
              <button className="symbolBtn" title="Скопировать тикер" onClick={() => copySymbol(c.symbol)}>
                {c.symbol}
              </button>
            </td>
            <td className="money">{fmtUsd(c.maxPositionUsd)}</td>
            <td>{c.bestTier?.maxLeverage}x / tier {c.bestTier?.tier}</td>
            <td>{fmtUsd(c.highestLevTier?.toUsd)} @ {c.highestLevTier?.maxLeverage}x</td>
            <td><span className={c.isZeroFee?'yes':'no'}>{c.isZeroFee?'YES':'NO'}</span></td>
            <td>{feePct(c.makerFee)} / {feePct(c.takerFee)}</td>
            <td>{Number(c.price).toPrecision(6)}</td>
            <td><button className="mini" onClick={()=>setOpen(o=>({...o,[c.symbol]:!o[c.symbol]}))}>{open[c.symbol]?'Скрыть':'Открыть'}</button></td>
          </tr>
          {open[c.symbol] && <tr className="details"><td colSpan="8">
            <h3>Все risk tiers для {c.symbol}</h3>
            <table className="inner"><thead><tr><th>Tier</th><th>Contracts range</th><th>Position $ range</th><th>Max leverage</th><th>IMR</th><th>MMR</th></tr></thead>
            <tbody>{(c.tiers||[]).map(t => <tr key={t.tier}>
              <td>{t.tier}</td><td>{fmtNum(t.fromContracts)} → {fmtNum(t.toContracts)}</td><td>{fmtUsd(t.fromUsd)} → {fmtUsd(t.toUsd)}</td><td>{t.maxLeverage}x</td><td>{fmtPct(t.imr)}</td><td>{fmtPct(t.mmr)}</td>
            </tr>)}</tbody></table>
            <p className="note">Формула для BY_VOLUME: tier 1 upper = riskBaseVol; tier N upper = riskBaseVol + riskIncrVol × (N-1). Leverage = 1 / IMR. Если MEXC отдаёт только один уровень, сайт не дорисовывает остальные.</p>
            {c.raw?.riskLimitType && <p className="note">Risk limit type: {c.raw.riskLimitType}</p>}
          </td></tr>}
        </>)}</tbody>
      </table>
    </section>
    <style jsx>{`
      .page{min-height:100vh;padding:48px 7vw;background:#070b12;color:#f7fbff}.hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;max-width:1320px;margin:0 auto 24px}.tag{color:#2ee8d6;font-weight:800;font-size:13px}h1{font-size:34px;margin:8px 0}p{color:#a7b5d1}.small{font-size:12px}.refresh,.active{background:#20c997;color:#061016;border:0;border-radius:14px;padding:14px 24px;font-weight:800}.filters{max-width:1320px;margin:0 auto 18px;background:#111927;border:1px solid #22304a;border-radius:20px;padding:16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}input{background:#090f1b;border:1px solid #2a3a59;color:white;padding:14px 18px;border-radius:14px;min-width:320px}label{font-weight:700}.filters button,.mini{background:#162542;color:#dbe8ff;border:1px solid #263b62;border-radius:12px;padding:11px 18px;font-weight:800}.copied{color:#36f2a2;font-weight:900}.tableWrap{max-width:1320px;margin:0 auto;border:1px solid #22304a;border-radius:18px;overflow:hidden;background:#101824}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:16px;border-bottom:1px solid #22304a}th{color:#8fbeff;background:#101827}.symbolBtn{background:transparent;border:0;color:#f7fbff;font-weight:900;font-size:15px;cursor:pointer;padding:0}.symbolBtn:hover{color:#2ee8d6;text-decoration:underline}.money{color:#36f2a2;font-weight:900;font-size:19px}.yes{background:#0f6b46;color:#60ffb2;padding:7px 12px;border-radius:999px;font-weight:900}.no{background:#5b2030;color:#ff9daf;padding:7px 12px;border-radius:999px;font-weight:900}.details td{background:#0b1220}.inner{margin-top:12px;background:#08101d;border-radius:14px;overflow:hidden}.note{margin-top:14px;color:#bcd0ff}.error{max-width:1320px;margin:0 auto 18px;background:#4d1420;border:1px solid #9b2e42;padding:14px;border-radius:14px}
    `}</style>
  </main>;
}
