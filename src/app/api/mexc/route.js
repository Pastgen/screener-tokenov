export const dynamic = 'force-dynamic';

const API_BASE = 'https://contract.mexc.com/api/v1';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getMarketType(coin) {
  const symbol = String(coin.symbol || '');
  const quote = String(coin.quoteCoin || '').toUpperCase();
  const settle = String(coin.settleCoin || '').toUpperCase();
  const base = String(coin.baseCoin || '').toUpperCase();
  const contractType = String(coin.contractType || coin.type || '').toUpperCase();

  if (settle === 'USDT' || quote === 'USDT' || symbol.endsWith('_USDT')) return 'USDT-M';
  if (settle === 'USDC' || quote === 'USDC' || symbol.endsWith('_USDC')) return 'USDC-M';
  if (settle === 'USD1' || quote === 'USD1' || symbol.endsWith('_USD1')) return 'USD1-M';
  if (settle === 'USD' || quote === 'USD' || symbol.endsWith('_USD')) return 'USD-M';
  if (contractType.includes('INVERSE') || (settle && settle === base)) return 'COIN-M';
  return settle ? `${settle}-M` : 'OTHER';
}

function getOverallContracts(coin) {
  const maxVol = toNumber(coin.maxVol);
  const riskBaseVol = toNumber(coin.riskBaseVol);
  const riskIncrVol = toNumber(coin.riskIncrVol);
  const riskLevelLimit = Math.max(1, toNumber(coin.riskLevelLimit, 1));

  // MEXC public contract fields often expose the overall position cap through risk fields.
  // We keep it separate from max leverage because this overall cap is NOT necessarily available at max leverage.
  const riskOverall = riskBaseVol > 0
    ? riskBaseVol + Math.max(0, riskLevelLimit - 1) * riskIncrVol
    : 0;

  return Math.max(maxVol, riskOverall);
}

function formatFee(value) {
  const n = toNumber(value);
  return n;
}

export async function GET() {
  try {
    const [contractsRes, tickersRes] = await Promise.all([
      fetch(`${API_BASE}/contract/detail`, { cache: 'no-store' }),
      fetch(`${API_BASE}/contract/ticker`, { cache: 'no-store' }),
    ]);

    if (!contractsRes.ok || !tickersRes.ok) {
      return Response.json({ error: 'MEXC request failed' }, { status: 502 });
    }

    const contractsJson = await contractsRes.json();
    const tickersJson = await tickersRes.json();

    const tickers = Array.isArray(tickersJson.data) ? tickersJson.data : [];
    const prices = Object.fromEntries(tickers.map((t) => [t.symbol, toNumber(t.lastPrice || t.fairPrice || t.indexPrice)]));

    const contracts = Array.isArray(contractsJson.data) ? contractsJson.data : [];

    const coins = contracts
      .filter((coin) => coin && coin.symbol)
      .map((coin) => {
        const price = prices[coin.symbol] || toNumber(coin.fairPrice || coin.indexPrice || coin.price);
        const contractSize = toNumber(coin.contractSize, 1);
        const contractsCap = getOverallContracts(coin);
        const maxSizeUsd = contractsCap * contractSize * price;
        const makerFee = formatFee(coin.makerFeeRate);
        const takerFee = formatFee(coin.takerFeeRate);
        const marketType = getMarketType(coin);

        return {
          symbol: coin.symbol,
          displaySymbol: String(coin.symbol).replace('_', ''),
          marketType,
          quoteCoin: coin.quoteCoin || null,
          settleCoin: coin.settleCoin || null,
          maxSizeUsd,
          contracts: contractsCap,
          maxLeverage: toNumber(coin.maxLeverage),
          makerFee,
          takerFee,
          isZeroFee: makerFee === 0 && takerFee === 0,
          price,
        };
      })
      .filter((coin) => coin.price > 0)
      .sort((a, b) => b.maxSizeUsd - a.maxSizeUsd);

    return Response.json({ updatedAt: new Date().toISOString(), coins });
  } catch (error) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
