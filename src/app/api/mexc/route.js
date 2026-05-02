export const dynamic = 'force-dynamic';

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function roundLeverage(imr, fallback) {
  if (!imr || imr <= 0) return fallback;
  const raw = 1 / imr;
  if (raw >= 100) return Math.round(raw / 25) * 25;
  if (raw >= 50) return Math.round(raw / 10) * 10;
  if (raw >= 20) return Math.round(raw / 5) * 5;
  return Math.max(1, Math.round(raw));
}

function makeRiskTiers(contract, price) {
  const contractSize = toNum(contract.contractSize, 1);
  const maxLev = toNum(contract.maxLeverage, 1);
  const riskBaseVol = toNum(contract.riskBaseVol || contract.riskBaseVolLong || contract.maxVol, 0);
  const riskIncrVol = toNum(contract.riskIncrVol || contract.riskIncrVolLong, 0);
  const initialImr = toNum(contract.initialMarginRate, maxLev ? 1 / maxLev : 0);
  const baseMmr = toNum(contract.maintenanceMarginRate, 0);
  const incrImr = toNum(contract.riskIncrImr, 0);
  const incrMmr = toNum(contract.riskIncrMmr, 0);
  const limit = Math.max(1, Math.min(toNum(contract.riskLevelLimit, riskIncrVol > 0 ? 10 : 1), 30));

  const tiers = [];
  let prevUpper = 0;

  for (let i = 1; i <= limit; i += 1) {
    let upperContracts;
    if (i === 1) upperContracts = riskBaseVol;
    else upperContracts = riskBaseVol + riskIncrVol * (i - 1);

    if (!upperContracts || upperContracts <= prevUpper) break;

    const imr = initialImr + incrImr * (i - 1);
    const mmr = baseMmr + incrMmr * (i - 1);
    const lev = Math.min(maxLev || 9999, roundLeverage(imr, maxLev));
    const minUsd = prevUpper * contractSize * price;
    const maxUsd = upperContracts * contractSize * price;

    tiers.push({
      tier: i,
      fromContracts: prevUpper,
      toContracts: upperContracts,
      fromUsd: minUsd,
      toUsd: maxUsd,
      maxLeverage: lev,
      imr,
      mmr
    });

    prevUpper = upperContracts;
  }

  if (!tiers.length) {
    const maxVol = toNum(contract.maxVol, 0);
    tiers.push({
      tier: 1,
      fromContracts: 0,
      toContracts: maxVol,
      fromUsd: 0,
      toUsd: maxVol * contractSize * price,
      maxLeverage: maxLev,
      imr: initialImr,
      mmr: baseMmr
    });
  }

  return tiers;
}

export async function GET() {
  try {
    const [contractsRes, tickersRes] = await Promise.all([
      fetch('https://contract.mexc.com/api/v1/contract/detail', { cache: 'no-store' }),
      fetch('https://contract.mexc.com/api/v1/contract/ticker', { cache: 'no-store' })
    ]);

    const contractsJson = await contractsRes.json();
    const tickersJson = await tickersRes.json();

    const prices = {};
    for (const t of tickersJson?.data || []) prices[t.symbol] = toNum(t.lastPrice || t.last_price || t.fairPrice || t.indexPrice, 0);

    const result = (contractsJson?.data || []).map((c) => {
      const price = prices[c.symbol] || toNum(c.fairPrice || c.indexPrice, 0);
      const tiers = makeRiskTiers(c, price);
      const bestTier = tiers.reduce((best, t) => (t.toUsd > best.toUsd ? t : best), tiers[0]);
      const highestLevTier = tiers.reduce((best, t) => (t.maxLeverage > best.maxLeverage ? t : best), tiers[0]);
      const makerFee = toNum(c.makerFeeRate, 0);
      const takerFee = toNum(c.takerFeeRate, 0);

      return {
        symbol: c.symbol,
        price,
        makerFee,
        takerFee,
        isZeroFee: makerFee === 0 && takerFee === 0,
        maxLeverage: toNum(c.maxLeverage, 0),
        maxPositionUsd: bestTier.toUsd,
        bestTier,
        highestLevTier,
        tiers,
        raw: {
          riskBaseVol: c.riskBaseVol,
          riskIncrVol: c.riskIncrVol,
          riskLevelLimit: c.riskLevelLimit,
          initialMarginRate: c.initialMarginRate,
          maintenanceMarginRate: c.maintenanceMarginRate,
          riskIncrImr: c.riskIncrImr,
          riskIncrMmr: c.riskIncrMmr,
          contractSize: c.contractSize,
          riskLimitType: c.riskLimitType
        }
      };
    }).filter(x => x.price > 0 && x.maxPositionUsd > 0);

    return Response.json({ ok: true, updatedAt: new Date().toISOString(), count: result.length, data: result });
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
