export const dynamic = "force-dynamic";

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getTickerPrice(t) {
  return toNum(
    t.lastPrice ?? t.last ?? t.fairPrice ?? t.indexPrice ?? t.bid1 ?? t.ask1,
    0
  );
}

function getOverallMaxContracts(coin) {
  const maxVol = toNum(coin.maxVol, 0);
  const riskBaseVol = toNum(coin.riskBaseVol, 0);
  const riskIncrVol = toNum(coin.riskIncrVol, 0);
  const riskLevelLimit = Math.max(1, toNum(coin.riskLevelLimit, 1));

  // Overall position capacity estimate from public risk fields.
  // This is NOT attached to maxLeverage. It is only the largest position size.
  const riskUpper = riskBaseVol > 0
    ? riskBaseVol + riskIncrVol * Math.max(0, riskLevelLimit - 1)
    : 0;

  return Math.max(maxVol, riskUpper);
}

export async function GET() {
  try {
    const [detailsRes, tickerRes] = await Promise.all([
      fetch("https://contract.mexc.com/api/v1/contract/detail", { cache: "no-store" }),
      fetch("https://contract.mexc.com/api/v1/contract/ticker", { cache: "no-store" })
    ]);

    const detailsJson = await detailsRes.json();
    const tickerJson = await tickerRes.json();

    const details = Array.isArray(detailsJson.data) ? detailsJson.data : [];
    const tickers = Array.isArray(tickerJson.data) ? tickerJson.data : [];

    const prices = new Map();
    for (const t of tickers) {
      if (t.symbol) prices.set(t.symbol, getTickerPrice(t));
    }

    const rows = details
      .filter((coin) => coin && coin.symbol && coin.symbol.includes("_"))
      .map((coin) => {
        const price = prices.get(coin.symbol) || 0;
        const contractSize = toNum(coin.contractSize, 1);
        const maxVol = toNum(coin.maxVol, 0);
        const overallMaxContracts = getOverallMaxContracts(coin);
        const maxSizeUsd = overallMaxContracts * contractSize * price;
        const basicMaxUsd = maxVol * contractSize * price;
        const makerFee = toNum(coin.makerFeeRate, 0);
        const takerFee = toNum(coin.takerFeeRate, 0);

        return {
          symbol: coin.symbol,
          maxSizeUsd,
          basicMaxUsd,
          maxLeverage: toNum(coin.maxLeverage, 0),
          makerFee,
          takerFee,
          isZeroFee: makerFee === 0 && takerFee === 0,
          price,
          maxVol,
          overallMaxContracts,
          source: overallMaxContracts > maxVol ? "risk fields" : "maxVol"
        };
      })
      .filter((r) => r.price > 0)
      .sort((a, b) => b.maxSizeUsd - a.maxSizeUsd);

    return Response.json({ ok: true, updatedAt: new Date().toISOString(), rows });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
