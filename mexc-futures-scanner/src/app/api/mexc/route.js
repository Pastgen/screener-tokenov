export const dynamic = 'force-dynamic';

const MEXC_BASE = 'https://contract.mexc.com';

async function getJson(path) {
  const res = await fetch(`${MEXC_BASE}${path}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`MEXC ${path} failed: ${res.status}`);
  return res.json();
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET() {
  try {
    const [details, tickers] = await Promise.all([
      getJson('/api/v1/contract/detail'),
      getJson('/api/v1/contract/ticker'),
    ]);

    const priceBySymbol = new Map();
    for (const t of tickers?.data || []) {
      priceBySymbol.set(t.symbol, number(t.lastPrice || t.fairPrice || t.indexPrice));
    }

    const rows = (details?.data || [])
      .filter((c) => c.state === 0 || c.state === undefined)
      .map((c) => {
        const price = priceBySymbol.get(c.symbol) || 0;
        const maxVol = number(c.maxVol);
        const contractSize = number(c.contractSize, 1);
        const maxPositionUsd = maxVol * contractSize * price;
        const makerFee = number(c.makerFeeRate);
        const takerFee = number(c.takerFeeRate);

        return {
          symbol: c.symbol,
          displaySymbol: String(c.symbol || '').replace('_', ''),
          price,
          maxVol,
          contractSize,
          maxPositionUsd,
          maxLeverage: number(c.maxLeverage),
          minLeverage: number(c.minLeverage),
          makerFee,
          takerFee,
          isZeroFee: makerFee === 0 && takerFee === 0,
          apiAllowed: c.apiAllowed !== false,
          riskLimitType: c.riskLimitType || 'UNKNOWN',
          riskLevelLimit: number(c.riskLevelLimit),
          raw: {
            riskLimitType: c.riskLimitType,
            riskLevelLimit: c.riskLevelLimit,
            maxVol: c.maxVol,
            maxLeverage: c.maxLeverage,
          },
        };
      })
      .sort((a, b) => b.maxPositionUsd - a.maxPositionUsd);

    return Response.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      note: 'Public MEXC data. Full per-tier risk limits may require MEXC private/account endpoint or public page parsing.',
      rows,
    });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
