export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [contractsRes, tickersRes] = await Promise.all([
      fetch('https://contract.mexc.com/api/v1/contract/detail', { cache: 'no-store' }),
      fetch('https://contract.mexc.com/api/v1/contract/ticker', { cache: 'no-store' }),
    ]);

    const contractsJson = await contractsRes.json();
    const tickersJson = await tickersRes.json();

    const tickers = Array.isArray(tickersJson.data) ? tickersJson.data : [];
    const priceMap = Object.fromEntries(tickers.map(t => [t.symbol, Number(t.lastPrice || t.fairPrice || 0)]));

    const contracts = Array.isArray(contractsJson.data) ? contractsJson.data : [];

    const data = contracts
      .filter(c => c && c.symbol && String(c.symbol).endsWith('_USDT'))
      .map(c => {
        const price = Number(priceMap[c.symbol] || 0);
        const maxVol = Number(c.maxVol || 0);
        const contractSize = Number(c.contractSize || 1);
        const maxPositionUsd = maxVol * contractSize * price;
        const makerFee = Number(c.makerFeeRate ?? c.makerFee ?? 0);
        const takerFee = Number(c.takerFeeRate ?? c.takerFee ?? 0);
        return {
          symbol: c.symbol,
          price,
          maxVol,
          contractSize,
          maxPositionUsd,
          maxLeverage: Number(c.maxLeverage || 0),
          makerFee,
          takerFee,
          isZeroFee: makerFee === 0 && takerFee === 0,
        };
      })
      .sort((a,b) => b.maxPositionUsd - a.maxPositionUsd);

    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message || 'MEXC API error' }, { status: 500 });
  }
}
