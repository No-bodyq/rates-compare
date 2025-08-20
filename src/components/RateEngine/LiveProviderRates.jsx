"use client";
import React, { useMemo } from "react";

export default function LiveProviderRates({
  fetchedRates,
  fetchedOrgRates,
  fromCurrency,
  toCurrency,
  getProvidersForCorridor,
  findBestRate,
  sendAmount,
  isCurrentCorridorCrypto,
  formatNumber,
}) {
  // Combine fetchedRates and fetchedOrgRates, filtering by currency pair and today's date for fetchedRates
  const combinedRates = useMemo(() => {
    const rates = [];
    const today = new Date();

    // Add rates from fetchedRates for the selected currency pair and today
    if (fetchedRates?.data) {
      rates.push(
        ...fetchedRates.data
          .filter(
            (rate) =>
              rate.from_currency === fromCurrency &&
              rate.to_currency === toCurrency &&
              new Date(rate.updatedAt).getFullYear() === today.getFullYear() &&
              new Date(rate.updatedAt).getMonth() === today.getMonth() &&
              new Date(rate.updatedAt).getDate() === today.getDate()
          )
          .map((rate) => ({
            ...rate,
            type: "provider",
            name: rate.provider,
            apiSource: rate.apiSource || "fiat",
            rate: rate.rate || rate.exchangeRate,
          }))
      );
    }

    // Add rates from fetchedOrgRates for the selected currency pair (no date filter)
    if (fetchedOrgRates) {
      Object.values(fetchedOrgRates).forEach((orgRates) => {
        if (orgRates?.data) {
          orgRates.data
            .filter(
              (rate) => rate.from_currency === fromCurrency && rate.to_currency === toCurrency
            )
            .forEach((rate, index) => {
              const baseProviderRate = fetchedRates?.data?.find(
                (r) =>
                  r.provider === rate.provider &&
                  r.from_currency === fromCurrency &&
                  r.to_currency === toCurrency
              );
              const baseRate = baseProviderRate
                ? parseFloat(baseProviderRate.rate || baseProviderRate.exchangeRate)
                : isCurrentCorridorCrypto
                ? 0.00000001
                : 0.00046;
              const computedRate = baseRate * (1 + (rate.spread || 0) / 100);
              rates.push({
                provider: `PCX: ${rate.org_id.slice(0, 8)}`,
                name: `PCX: ${orgRates.data[0]?.org_name || rate.org_id.slice(0, 8)}`,
                from_currency: rate.from_currency,
                to_currency: rate.to_currency,
                rate: computedRate.toString(),
                updatedAt: rate.updated_at || new Date().toISOString(),
                apiSource: "pcx",
                type: "pcx",
                uniqueId: `${rate.org_id}-${rate.config_id}-${index}`,
                status: rate.active ? "active" : "inactive",
              });
            });
        }
      });
    }

    // Deduplicate by provider, keeping the most recent rate by updatedAt
    const rateMap = new Map();
    rates.forEach((rate) => {
      const provider = rate.provider;
      const currentRate = rateMap.get(provider);
      const rateTimestamp = new Date(rate.updatedAt || rate.updated_at).getTime();
      const currentTimestamp = currentRate ? new Date(currentRate.updatedAt || currentRate.updated_at).getTime() : 0;
      if (!currentRate || rateTimestamp > currentTimestamp) {
        rateMap.set(provider, rate);
      }
    });

    return { data: Array.from(rateMap.values()) };
  }, [fetchedRates, fetchedOrgRates, fromCurrency, toCurrency, isCurrentCorridorCrypto]);

  return (
    combinedRates?.data?.length > 0 && (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Live Provider Rates for {fromCurrency} → {toCurrency}
          </h3>
          <span className="text-xs text-gray-500">
            {getProvidersForCorridor(combinedRates, fromCurrency, toCurrency).length} providers available
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {getProvidersForCorridor(combinedRates, fromCurrency, toCurrency).map((provider) => {
            const bestRate = findBestRate(combinedRates, fromCurrency, toCurrency, parseFloat(sendAmount), provider);
            return bestRate ? (
              <div
                key={provider}
                className={`border rounded-lg p-3 ${
                  bestRate.apiSource === "crypto"
                    ? "bg-orange-50 border-orange-200"
                    : bestRate.apiSource === "pcx"
                    ? "bg-purple-50 border-purple-200"
                    : "bg-green-50 border-green-200"
                }`}
              >
                <div
                  className={`text-xs font-medium capitalize flex items-center gap-2 ${
                    bestRate.apiSource === "crypto"
                      ? "text-orange-800"
                      : bestRate.apiSource === "pcx"
                      ? "text-purple-800"
                      : "text-green-800"
                  }`}
                >
                  {provider}
                  {bestRate.type === "pcx" && bestRate.status === "inactive" && (
                    <span className="px-1 py-0.5 text-xs font-medium bg-yellow-600 text-white rounded">
                      INACTIVE
                    </span>
                  )}
                </div>
                <div
                  className={`text-lg font-bold ${
                    bestRate.apiSource === "crypto"
                      ? "text-orange-900"
                      : bestRate.apiSource === "pcx"
                      ? "text-purple-900"
                      : "text-green-900"
                  }`}
                >
                  {formatNumber(bestRate.rate)}
                </div>
                <div
                  className={`text-xs ${
                    bestRate.apiSource === "crypto"
                      ? "text-orange-700"
                      : bestRate.apiSource === "pcx"
                      ? "text-purple-700"
                      : "text-green-700"
                  }`}
                >
                  Updated: {new Date(bestRate.updatedAt || bestRate.updated_at).toLocaleTimeString()}
                </div>
              </div>
            ) : null;
          })}
        </div>
        {getProvidersForCorridor(combinedRates, fromCurrency, toCurrency).length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No rates available for {fromCurrency} → {toCurrency} corridor. Click 'Scrape {isCurrentCorridorCrypto ? "Crypto " : ""}Rates' to fetch from providers.
          </div>
        )}
      </div>
    )
  );
}
