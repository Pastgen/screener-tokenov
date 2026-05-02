export const dynamic = "force-dynamic";

const API = "https://contract.mexc.com/api/v1";

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getPrice(ticker) {
  return toNumber(
    ticker?.lastPrice ?? ticker?.fairPrice ?? ticker?.indexPrice ?? ticker?.bid1 ?? ticker?.ask1,
    0
  );
}

function buildRiskTiers(coin, price) {
  const contractSize = toNumber(coin.contractSize, 1);
  const riskLevelLimit = Math.max(1, toNumber(coin.riskLevelLimit, 1));
  const baseVol = toNumber(
    coin.riskBaseVolLong || coin.riskBaseVolShort || coin.riskBaseVol || coin.maxVol,
    toNumber(coin.maxVol, 0)
  );
  const incrVol = toNumber(
    coin.riskIncrVolLong || coin.riskIncrVolShort || coin.riskIncrVol,
    0
  );
  const initialMarginRate = toNumber(coin.initialMarginRate, coin.maxLeverage ? 1 / toNumber(coin.maxLeverage, 1) : 0);
  const incrImr = toNumber(coin.riskIncrImr, 0);
  const maintenanceMarginRate = toNumber(coin.maintenanceMarginRate, 0);
  const incrMmr = toNumber(coin.riskIncrMmr, 0);

  const tiers = [];

  for (let level = 1; level <= riskLevelLimit; level++) {
    const lowerVol = level === 1 ? 0 : baseVol + incrVol * (level - 2);
    const upperVol = level === 1 ? baseVol : baseVol + incrVol * (level - 1);

    if (!upperVol || upperVol <= lowerVol) continue;

    const imr = initialMarginRate + incrImr * (level - 1);
    const mmr = maintenanceMarginRate + incrMmr * (level - 1);
    const leverageFromImr = imr > 0 ? Math.floor(1 / imr) : toNumber(coin.maxLeverage, 0);
    const leverage = Math.max(1, Math.min(toNumber(coin.maxLeverage, leverageFromImr), leverageFromImr || toNumber(coin.maxLeverage, 1)));
    const minPositionUsd = lowerVol * contractSize * price;
    const maxPositionUsd = upperVol * contractSize * price;

    tiers.push({
      level,
      lowerVol,
      upperVol,
      minPositionUsd,
      maxPositionUsd,
      maxLeverage: leverage,
      maintenanceMarginRate: mmr,
      initialMarginRate: imr,
    });
  }

  if (!tiers.length) {
    const maxVol = toNumber(coin.maxVol, 0);
    tiers.push({
      level: 1,
      lowerVol: 0,
      upperVol: maxVol,
      minPositionUsd: 0,
      maxPositionUsd: maxVol * contractSize * price,
      maxLeverage: toNumber(coin.maxLeverage, 0),
      maintenanceMarginRate: toNumber(coin.maintenanceMarginRate, 0),
      initialMarginRate,
    });
  }

  return tiers;
}

export async function GET() {
  try {
    const [contractsRes, tickersRes] = await Promise.all([
      fetch(`${API}/contract/detail/country`, { cache: "no-store" }),
      fetch(`${API}/contract/ticker`, { cache: "no-store" }),
    ]);

    const contractsJson = await contractsRes.json();
    const tickersJson = await tickersRes.json();

    const contracts = Array.isArray(contractsJson.data)
      ? contractsJson.data
      : contractsJson.data
      ? [contractsJson.data]
      : [];

    const tickers = Array.isArray(tickersJson.data) ? tickersJson.data : [];
    const tickerMap = Object.fromEntries(tickers.map((t) => [t.symbol, t]));

    const result = contracts
      .filter((coin) => coin.symbol && coin.state === 0)
      .map((coin) => {
        const ticker = tickerMap[coin.symbol] || {};
        const price = getPrice(ticker);
        const tiers = buildRiskTiers(coin, price);
        const bestTier = tiers.reduce((best, tier) =>
          tier.maxPositionUsd > best.maxPositionUsd ? tier : best
        , tiers[0]);
        const highestLeverageTier = tiers.reduce((best, tier) =>
          tier.maxLeverage > best.maxLeverage ? tier : best
        , tiers[0]);

        const makerFee = toNumber(coin.makerFeeRate, 0);
        const takerFee = toNumber(coin.takerFeeRate, 0);
        const tieredZero = Array.isArray(coin.tieredFeeRates) && coin.tieredFeeRates.some((f) => toNumber(f.makerFeeRate, 1) === 0 && toNumber(f.takerFeeRate, 1) === 0);

        return {
          symbol: coin.symbol,
          price,
          contractSize: toNumber(coin.contractSize, 1),
          maxVol: toNumber(coin.maxVol, 0),
          maxLeverage: toNumber(coin.maxLeverage, 0),
          makerFee,
          takerFee,
          isZeroFee: (makerFee === 0 && takerFee === 0) || tieredZero,
          volume24: toNumber(ticker.volume24, 0),
          turnover24: toNumber(ticker.amount24, 0),
          riskLimitType: coin.riskLimitType || "BY_VOLUME",
          riskLevelLimit: tiers.length,
          bestMaxPositionUsd: bestTier.maxPositionUsd,
          bestTierLevel: bestTier.level,
          bestTierLeverage: bestTier.maxLeverage,
          highestLeveragePositionUsd: highestLeverageTier.maxPositionUsd,
          highestLeverage: highestLeverageTier.maxLeverage,
          tiers,
        };
      })
      .sort((a, b) => b.bestMaxPositionUsd - a.bestMaxPositionUsd);

    return Response.json({ ok: true, updatedAt: Date.now(), count: result.length, data: result });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Unknown error", data: [] }, { status: 500 });
  }
}
