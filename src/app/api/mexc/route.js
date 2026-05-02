export const dynamic = "force-dynamic";

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeFee(v) {
  const n = num(v, 0);
  // MEXC can return either percent-like 0 or decimal-like 0.0002.
  // UI will multiply tiny decimal fees by 100.
  return n;
}

export async function GET() {
  try {
    const [contractsRes, tickersRes] = await Promise.all([
      fetch("https://contract.mexc.com/api/v1/contract/detail", { cache: "no-store" }),
      fetch("https://contract.mexc.com/api/v1/contract/ticker", { cache: "no-store" })
    ]);

    const contractsJson = await contractsRes.json();
    const tickersJson = await tickersRes.json();

    const tickers = Array.isArray(tickersJson?.data) ? tickersJson.data : [];
    const prices = Object.fromEntries(
      tickers.map((t) => [t.symbol, num(t.lastPrice ?? t.last_price ?? t.price, 0)])
    );

    const contracts = Array.isArray(contractsJson?.data) ? contractsJson.data : [];

    const rows = contracts
      .filter((c) => c && c.symbol && (c.state === 0 || c.state === "0" || c.state === undefined))
      .map((c) => {
        const price = prices[c.symbol] || num(c.lastPrice ?? c.indexPrice ?? c.fairPrice, 0);
        const maxVol = num(c.maxVol, 0);
        const contractSize = num(c.contractSize, 1);

        // IMPORTANT:
        // This is the overall public max size from MEXC contract detail.
        // It is NOT attached to maxLeverage and does NOT claim the max size is available at max leverage.
        const maxSizeUsd = maxVol * contractSize * price;

        const makerFee = normalizeFee(c.makerFeeRate ?? c.makerFee ?? 0);
        const takerFee = normalizeFee(c.takerFeeRate ?? c.takerFee ?? 0);
        const isZeroFee = makerFee === 0 && takerFee === 0;

        return {
          symbol: c.symbol,
          maxSizeUsd,
          maxVol,
          contractSize,
          maxLeverage: num(c.maxLeverage, 0),
          price,
          makerFee,
          takerFee,
          isZeroFee,
          source: "contract/detail"
        };
      })
      .sort((a, b) => b.maxSizeUsd - a.maxSizeUsd);

    return Response.json({ updatedAt: new Date().toISOString(), rows });
  } catch (error) {
    return Response.json({ error: true, message: error?.message || "Failed to fetch MEXC data" }, { status: 500 });
  }
}
