const DETAIL_URL = 'https://contract.mexc.com/api/v1/contract/detail';
const TICKER_URL = 'https://contract.mexc.com/api/v1/contract/ticker';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function marketType(coin) {
  const symbol = String(coin.symbol || '');
  const settle = String(coin.settleCoin || coin.quoteCoin || '').toUpperCase();
  if (settle === 'USDT') return 'USDT-M';
  if (settle === 'USDC') return 'USDC-M';
  if (settle === 'USD1') return 'USD1-M';
  if (settle === 'USD') return 'USD-M';
  if (symbol.endsWith('_USD')) return 'USD-M';
  return settle ? `${settle}-M` : 'COIN-M';
}

function maxContractsOverall(coin) {
  const maxVol = num(coin.maxVol);
  const riskBaseVol = num(coin.riskBaseVol);
  const riskIncrVol = num(coin.riskIncrVol);
  const riskLevelLimit = num(coin.riskLevelLimit);

  // This is the overall max position size derived from MEXC public risk fields.
  // It is intentionally NOT tied to maxLeverage.
  if (riskBaseVol > 0 && riskIncrVol > 0 && riskLevelLimit > 0) {
    return riskBaseVol + riskIncrVol * Math.max(0, riskLevelLimit - 1);
  }

  if (riskBaseVol > 0 && riskIncrVol > 0) {
    return riskBaseVol + riskIncrVol;
  }

  if (riskBaseVol > 0) return riskBaseVol;
  return maxVol;
}

export async function GET() {
  try {
    const [detailsRes, tickersRes] = await Promise.all([
      fetch(DETAIL_URL, { next: { revalidate: 60 } }),
      fetch(TICKER_URL, { next: { revalidate: 15 } })
    ]);

    if (!detailsRes.ok || !tickersRes.ok) {
      return Response.json({ error: 'MEXC API request failed' }, { status: 502 });
    }

    const detailsJson = await detailsRes.json();
    const tickersJson = await tickersRes.json();
    const details = Array.isArray(detailsJson.data) ? detailsJson.data : [];
    const tickers = Array.isArray(tickersJson.data) ? tickersJson.data : [];

    const priceBySymbol = new Map(
      tickers.map((t) => [String(t.symbol), num(t.lastPrice || t.fairPrice || t.indexPrice)])
    );

    const result = details
      .filter((coin) => coin && coin.symbol)
      .map((coin) => {
        const symbol = String(coin.symbol);
        const price = priceBySymbol.get(symbol) || num(coin.lastPrice || coin.price);
        const contractSize = num(coin.contractSize, 1);
        const contracts = maxContractsOverall(coin);
        const maxSizeUsd = contracts * contractSize * price;
        const makerFee = num(coin.makerFeeRate) * 100;
        const takerFee = num(coin.takerFeeRate) * 100;

        return {
          symbol,
          market: marketType(coin),
          maxSizeUsd,
          contracts,
          maxLeverage: num(coin.maxLeverage),
          makerFee,
          takerFee,
          zeroFee: makerFee === 0 && takerFee === 0,
          price,
        };
      })
      .filter((coin) => coin.price > 0 && coin.maxSizeUsd > 0);

    return Response.json({ updatedAt: new Date().toISOString(), data: result });
  } catch (error) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
