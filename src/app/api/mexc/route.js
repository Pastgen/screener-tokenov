export const dynamic = "force-dynamic";

const MEXC_BASE = "https://contract.mexc.com";

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickPrice(t) {
  return num(t?.lastPrice ?? t?.last ?? t?.fairPrice ?? t?.indexPrice ?? t?.bid1 ?? t?.ask1);
}

export async function GET() {
  try {
    const [detailRes, tickerRes] = await Promise.all([
      fetch(`${MEXC_BASE}/api/v1/contract/detail`, { cache: "no-store" }),
      fetch(`${MEXC_BASE}/api/v1/contract/ticker`, { cache: "no-store" })
    ]);

    const detailJson = await detailRes.json();
    const tickerJson = await tickerRes.json();

    const tickers = Array.isArray(tickerJson.data) ? tickerJson.data : [];
    const prices = new Map(tickers.map((t) => [t.symbol, pickPrice(t)]));
    const turnover = new Map(tickers.map((t) => [t.symbol, num(t.amount24 ?? t.turnover24 ?? t.holdVol)]));

    const contracts = Array.isArray(detailJson.data) ? detailJson.data : [];

    const data = contracts
      .filter((c) => c?.state === 0 || c?.state === "0" || c?.symbol)
      .map((c) => {
        const symbol = c.symbol;
        const price = prices.get(symbol) || num(c.price);
        const contractSize = num(c.contractSize, 1);
        const maxVol = num(c.maxVol);
        const maxPositionUsd = maxVol * contractSize * price;
        const maxLeverage = num(c.maxLeverage);
        const makerFee = num(c.makerFeeRate);
        const takerFee = num(c.takerFeeRate);
        const isZeroFee = makerFee === 0 && takerFee === 0;

        return {
          symbol,
          price,
          contractSize,
          maxVol,
          maxPositionUsd,
          maxLeverage,
          makerFee,
          takerFee,
          isZeroFee,
          volume24Usd: turnover.get(symbol) || 0,
          updatedAt: new Date().toISOString()
        };
      })
      .filter((c) => c.symbol && c.price > 0)
      .sort((a, b) => b.maxPositionUsd - a.maxPositionUsd);

    return Response.json({ success: true, updatedAt: new Date().toISOString(), data });
  } catch (error) {
    return Response.json({ success: false, error: error?.message || "Unknown error" }, { status: 500 });
  }
}
