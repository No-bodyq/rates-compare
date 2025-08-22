"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Plus, Minus } from "lucide-react";
import { getPCXAuthToken, getOrganizations, getExchangeRates, getExchangeRatesByOrg, refreshPCXAuthToken } from "../../services/auth-service";
import useAuthStore from "../../stores/authStore";
import { toast, ToastContainer } from "react-toastify";
import Header from "../../components/RateEngine/Header";
import SettingsPanel from "../../components/RateEngine/SettingsPanel";
import ErrorMessage from "../../components/RateEngine/ErrorMessage";
import InputSection from "../../components/RateEngine/InputSection";
import LiveProviderRates from "../../components/RateEngine/LiveProviderRates";
import BenchmarkTable from "../../components/RateEngine/BenchmarkTable";
import ComparisonChart from "../../components/RateEngine/ComparisonChart";
import Simulator from "../../components/RateEngine/Simulator";

const CRYPTOCURRENCIES = [
    'BTC', 'ETH', 'USDC', 'USDT', 'LTC', 'BCH', 'XRP', 'ADA', 'DOT', 'LINK',
    'UNI', 'AAVE', 'COMP', 'MKR', 'SNX', 'YFI', 'SUSHI', 'CRV', 'BAL',
    'MATIC', 'AVAX', 'SOL', 'LUNA', 'ATOM', 'FTT', 'NEAR', 'ALGO', 'VET',
    'ICP', 'THETA', 'XLM', 'TRX', 'ETC', 'FIL', 'XMR', 'CAKE', 'MANA',
    'DOGE', 'SHIB', 'WBTC', 'DAI', 'BUSD', 'FRAX'
];

// Define fiat currencies for better detection
const FIAT_CURRENCIES = [
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK',
    'NGN', 'KES', 'KSH', 'ZAR', 'GHS', 'UGX', 'TZS', 'INR', 'BRL', 'MXN',
    'CNY', 'RUB', 'TRY', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'ISK',
    'RWF', 'ETB', 'XOF', 'XAF', 'MAD', 'EGP'
];

// Function to check if a currency is a cryptocurrency
const isCryptocurrency = (currency) => {
    return CRYPTOCURRENCIES.includes(currency.toUpperCase());
};

// Function to check if a currency is fiat
const isFiatCurrency = (currency) => {
    return FIAT_CURRENCIES.includes(currency.toUpperCase());
};

// Function to determine if the request involves crypto
const shouldUseCryptoAPI = (baseCurrency, targetCurrency) => {
    const baseIsCrypto = isCryptocurrency(baseCurrency);
    const targetIsCrypto = isCryptocurrency(targetCurrency);
    const baseIsFiat = isFiatCurrency(baseCurrency);
    const targetIsFiat = isFiatCurrency(targetCurrency);

    return baseIsCrypto || targetIsCrypto || !baseIsFiat || !targetIsFiat;
};

// Function to check if a rate is from today
const isRateFromToday = (updatedAt) => {
    const today = new Date();
    const rateDate = new Date(updatedAt);
    return (
        rateDate.getFullYear() === today.getFullYear() &&
        rateDate.getMonth() === today.getMonth() &&
        rateDate.getDate() === today.getDate()
    );
};

export default function RateEngine() {
    const [sendAmount, setSendAmount] = useState("1000");
    const [fromCurrency, setFromCurrency] = useState("USD");
    const [toCurrency, setToCurrency] = useState("NGN");
    const [activeTab, setActiveTab] = useState("benchmark");
    const [selectedPCXOrg, setSelectedPCXOrg] = useState("ROT Corporation");
    const [defaultOrg, setDefaultOrg] = useState({
        name: "pcx-retail",
        id: "96b7cd64-d0db-4dcc-97d1-5ecd1af14f9a",
    });
    const [showSettings, setShowSettings] = useState(false);
    const [spreadAdjustment, setSpreadAdjustment] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
    const [isLoadingAllRates, setIsLoadingAllRates] = useState(false);
    const [fetchedOrgs, setFetchedOrgs] = useState(null);
    const [fetchedRates, setFetchedRates] = useState(null);
    const [fetchedOrgRates, setFetchedOrgRates] = useState({});
    const [error, setError] = useState("");
    const [isDefaultOrgValid, setIsDefaultOrgValid] = useState(null);
    const [isUserInteracted, setIsUserInteracted] = useState(false);

    // Universal currency calculator function
    // const calculateRecipientAmount = useCallback((sendAmount, rate, fromCurrency, toCurrency, provider = null) => {
    //     const amount = parseFloat(sendAmount || 0);
    //     const rateValue = parseFloat(rate || 0);

    //     if (amount === 0 || rateValue === 0) return 0;

    //     // Special handling based on provider patterns and rate values
    //     const providerName = provider?.toLowerCase() || '';

    //     // Provider-specific logic (you can expand this based on your providers)
    //     if (providerName.includes('flutterwave') || providerName.includes('flutter')) {
    //         // Flutterwave typically gives rates as "fromCurrency per toCurrency"
    //         // e.g., 1607 NGN per 1 USD, so divide
    //         return amount / rateValue;
    //     }

    //     if (providerName.includes('ngnrates') || providerName.includes('ngn')) {
    //         // ngnrates typically gives "toCurrency per fromCurrency" 
    //         // e.g., 0.00217 USD per 1 NGN, so multiply
    //         return amount * rateValue;
    //     }

    //     if (providerName.includes('wise') || providerName.includes('transferwise')) {
    //         // Wise typically gives direct conversion rates
    //         return amount * rateValue;
    //     }

    //     if (providerName.includes('currency_api') || providerName.includes('exchange_rates_api')) {
    //         // Most currency APIs give direct conversion rates
    //         return amount * rateValue;
    //     }

    //     // General heuristic approach for unknown providers
    //     // This is a fallback when we can't identify the provider pattern

    //     // Method 1: Rate magnitude heuristic
    //     // If converting from a "smaller value" currency to "larger value" currency
    //     const fromCurrencySmaller = ['NGN', 'KES', 'UGX', 'TZS', 'RWF', 'INR', 'KRW', 'JPY', 'IDR'].includes(fromCurrency.toUpperCase());
    //     const toCurrencyLarger = ['USD', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD'].includes(toCurrency.toUpperCase());

    //     if (fromCurrencySmaller && toCurrencyLarger) {
    //         // Converting from high-value-number currency to low-value-number currency
    //         // Rate should typically be < 1, so multiply
    //         // If rate > 1, it's probably inverted, so divide
    //         return rateValue < 1 ? amount * rateValue : amount / rateValue;
    //     }

    //     const fromCurrencyLarger = ['USD', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD'].includes(fromCurrency.toUpperCase());
    //     const toCurrencySmaller = ['NGN', 'KES', 'UGX', 'TZS', 'RWF', 'INR', 'KRW', 'JPY', 'IDR'].includes(toCurrency.toUpperCase());

    //     if (fromCurrencyLarger && toCurrencySmaller) {
    //         // Converting from low-value-number currency to high-value-number currency  
    //         // Rate should typically be > 1, so multiply
    //         // If rate < 1, it's probably inverted, so divide
    //         return rateValue > 1 ? amount * rateValue : amount / rateValue;
    //     }

    //     // Method 2: Crypto handling
    //     if (isCryptocurrency(fromCurrency) || isCryptocurrency(toCurrency)) {
    //         // Crypto rates are typically very small when converting to fiat
    //         // or very large when converting from fiat
    //         if (isCryptocurrency(fromCurrency) && isFiatCurrency(toCurrency)) {
    //             // BTC -> USD: rate should be large (multiply)
    //             return amount * rateValue;
    //         }
    //         if (isFiatCurrency(fromCurrency) && isCryptocurrency(toCurrency)) {
    //             // USD -> BTC: rate should be small (multiply)  
    //             return amount * rateValue;
    //         }
    //         // Crypto to crypto
    //         return amount * rateValue;
    //     }

    //     // Method 3: Fallback - use the "reasonable result" heuristic
    //     const multiplyResult = amount * rateValue;
    //     const divideResult = amount / rateValue;

    //     // Check which result seems more reasonable
    //     // For most currency pairs, a reasonable exchange should be between 0.001 and 10000
    //     const multiplyReasonable = multiplyResult >= 0.001 && multiplyResult <= 10000;
    //     const divideReasonable = divideResult >= 0.001 && divideResult <= 10000;

    //     if (multiplyReasonable && !divideReasonable) {
    //         return multiplyResult;
    //     } else if (!multiplyReasonable && divideReasonable) {
    //         return divideResult;
    //     } else {
    //         // Both or neither seem reasonable, use the smaller rate magnitude approach
    //         return rateValue < 1 ? multiplyResult : divideResult;
    //     }
    // }, []);
    // Enhanced debugging system for rate calculation issues
    const calculateRecipientAmount = useCallback((sendAmount, rate, fromCurrency, toCurrency, provider = null) => {
        const amount = parseFloat(sendAmount || 0);
        const rateValue = parseFloat(rate || 0);

        if (amount === 0 || rateValue === 0) return 0;

        const providerName = provider?.toLowerCase() || '';

        // Define expected rate ranges for common currency pairs
        const expectedRanges = {
            'USD_GHS': { min: 9, max: 16, description: '1 USD = 9-16 GHS' },
            'USD_NGN': { min: 400, max: 2000, description: '1 USD = 400-2000 NGN' },
            'USD_KES': { min: 100, max: 180, description: '1 USD = 100-180 KES' },
            'USD_EUR': { min: 0.8, max: 1.1, description: '1 USD = 0.8-1.1 EUR' },
            'USD_GBP': { min: 0.7, max: 0.9, description: '1 USD = 0.7-0.9 GBP' },
            // Add reverse pairs
            'GHS_USD': { min: 0.06, max: 0.12, description: '1 GHS = 0.06-0.12 USD' },
            'NGN_USD': { min: 0.0005, max: 0.003, description: '1 NGN = 0.0005-0.003 USD' },
            'KES_USD': { min: 0.005, max: 0.01, description: '1 KES = 0.005-0.01 USD' },
            'EUR_USD': { min: 0.9, max: 1.3, description: '1 EUR = 0.9-1.3 USD' },
            'GBP_USD': { min: 1.1, max: 1.4, description: '1 GBP = 1.1-1.4 USD' },
        };

        const pairKey = `${fromCurrency}_${toCurrency}`;
        const expectedRange = expectedRanges[pairKey];

        // Debug function
        const debugRate = (action, originalRate, finalRate, calculation) => {
            const emoji = action === 'CORRECT' ? '✅' : action === 'INVERTED' ? '🔄' : '⚠️';
            console.log(`${emoji} ${provider} (${fromCurrency}→${toCurrency}): ${action}`);
            console.log(`   Original rate: ${originalRate}`);
            console.log(`   Final rate used: ${finalRate}`);
            console.log(`   Expected: ${expectedRange?.description || 'No range defined'}`);
            console.log(`   Calculation: ${amount} × ${finalRate} = ${calculation.toFixed(4)}`);
            console.log(`   ─────────────────────────────────`);

            // Add to window for easy inspection
            if (!window.rateDebugLog) window.rateDebugLog = [];
            window.rateDebugLog.push({
                provider,
                pair: `${fromCurrency}→${toCurrency}`,
                action,
                originalRate,
                finalRateUsed: finalRate,
                expected: expectedRange?.description,
                result: calculation
            });
        };

        let finalRate = rateValue;
        let action = 'UNKNOWN';
        let result;

        // Check if rate is within expected range
        if (expectedRange) {
            const isInRange = rateValue >= expectedRange.min && rateValue <= expectedRange.max;
            const invertedRate = 1 / rateValue;
            const isInvertedInRange = invertedRate >= expectedRange.min && invertedRate <= expectedRange.max;

            if (isInRange && !isInvertedInRange) {
                // Rate is correct
                finalRate = rateValue;
                action = 'CORRECT';
                result = amount * finalRate;
            } else if (!isInRange && isInvertedInRange) {
                // Rate is inverted
                finalRate = invertedRate;
                action = 'INVERTED';
                result = amount * finalRate;
            } else if (isInRange && isInvertedInRange) {
                // Both seem valid - use provider-specific logic
                action = 'AMBIGUOUS';
                finalRate = getProviderSpecificRate(providerName, rateValue, fromCurrency, toCurrency);
                result = amount * finalRate;
            } else {
                // Neither seems valid - flag as suspicious
                action = 'SUSPICIOUS';
                finalRate = rateValue; // Use as-is but flag it
                result = amount * finalRate;
            }
        } else {
            // No expected range defined - use provider-specific logic
            finalRate = getProviderSpecificRate(providerName, rateValue, fromCurrency, toCurrency);
            action = 'PROVIDER_LOGIC';
            result = amount * finalRate;
        }

        debugRate(action, rateValue, finalRate, result);
        return result;
    }, []);

    // Provider-specific rate handling
    const getProviderSpecificRate = (providerName, rateValue, fromCurrency, toCurrency) => {
        // Known provider patterns based on API documentation and testing
        const providerLogic = {
            'flutterwave': (rate, from, to) => {
                // Flutterwave typically returns direct conversion rates
                // But sometimes inverts for certain pairs
                if (from === 'USD' && to === 'GHS' && rate < 5) {
                    console.log('🔄 Flutterwave: Inverting USD→GHS rate');
                    return 1 / rate;
                }
                return rate;
            },

            'ngnrates': (rate, from, to) => {
                // ngnrates often returns inverted rates
                if (from === 'USD' && (to === 'GHS' || to === 'NGN') && rate < 1) {
                    console.log('🔄 ngnrates: Inverting USD→local currency rate');
                    return 1 / rate;
                }
                return rate;
            },

            'wise': (rate, from, to) => {
                // Wise is usually reliable with direct rates
                return rate;
            },

            'currency_api': (rate, from, to) => {
                // Most currency APIs return direct conversion rates
                return rate;
            },

            'exchange_rates_api': (rate, from, to) => {
                // Usually direct conversion rates
                return rate;
            },

            'sendwave': (rate, from, to) => {
                // Sendwave usually returns direct rates but can vary
                return rate;
            },

            'remitly': (rate, from, to) => {
                // Remitly usually returns direct rates
                return rate;
            },

            'western_union': (rate, from, to) => {
                // Western Union rates are often marked up
                return rate;
            }
        };

        // Try to find matching provider logic
        for (const [key, logic] of Object.entries(providerLogic)) {
            if (providerName.includes(key)) {
                return logic(rateValue, fromCurrency, toCurrency);
            }
        }

        // Default: return as-is
        return rateValue;
    };

    // Combine fetchedRates and fetchedOrgRates, filtering by currency pair and today's date for fetchedRates
    const combinedRates = useMemo(() => {
        const rates = [];
        if (fetchedRates?.data) {
            rates.push(
                ...fetchedRates.data.filter(
                    (rate) =>
                        rate.from_currency === fromCurrency &&
                        rate.to_currency === toCurrency &&
                        isRateFromToday(rate.updatedAt)
                )
            );
        }
        if (fetchedOrgRates) {
            Object.values(fetchedOrgRates).forEach((orgRates) => {
                if (orgRates?.data) {
                    rates.push(
                        ...orgRates.data.filter(
                            (rate) =>
                                rate.from_currency === fromCurrency &&
                                rate.to_currency === toCurrency
                        )
                    );
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
    }, [fetchedRates, fetchedOrgRates, fromCurrency, toCurrency]);

    useEffect(() => {
        const { initTokenRefresh } = useAuthStore.getState();
        const cleanup = initTokenRefresh();
        console.log('⏰ Token refresh interval initialized');
        return cleanup;
    }, []);

    const ScrapeRates = useCallback(
        async (base, target, amount) => {
            if (!base || !target) {
                console.log("🚫 ScrapeRates skipped: missing base or target currency");
                setError("Please select both source and recipient currencies");
                setIsLoadingAllRates(false);
                return;
            }
            if (!isUserInteracted || !amount) {
                console.log("🚫 ScrapeRates skipped: missing amount or user interaction");
                setIsLoadingAllRates(false);
                return;
            }

            setIsLoadingAllRates(true);
            setError("");
            setFetchedRates(null);

            const useCryptoAPI = shouldUseCryptoAPI(base, target);
            const apiEndpoint = useCryptoAPI
                ? `/api/crypto?base=${base}&target=${target}&amount=${amount}`
                : `/api/scrape-rates?base=${base}&target=${target}&amount=${amount}`;

            const currencyTypes = {
                base: isCryptocurrency(base) ? 'crypto' : isFiatCurrency(base) ? 'fiat' : 'unknown',
                target: isCryptocurrency(target) ? 'crypto' : isFiatCurrency(target) ? 'fiat' : 'unknown'
            };

            console.log(`🎯 Currency Analysis: ${base} (${currencyTypes.base}) → ${target} (${currencyTypes.target})`);
            console.log(`🎯 Using ${useCryptoAPI ? 'Crypto' : 'Fiat'} API: ${apiEndpoint}`);

            const toastMessage = useCryptoAPI
                ? "Fetching crypto rates from Coinbase..."
                : "Fetching rates from external providers...";

            toast.info(toastMessage, { toastId: "scrape-rates" });

            try {
                console.log(`🔄 Scraping rates: ${base} → ${target} (${amount}) via ${useCryptoAPI ? 'Crypto' : 'Fiat'} API`);

                const response = await fetch(apiEndpoint);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                console.log("📥 API response:", data);

                if (data.success && data.data.rates) {
                    const mappedRates = data.data.rates.map((rate, index) => ({
                        ...rate,
                        from_currency: base,
                        to_currency: target,
                        rate: rate.recipientReceives
                            ? rate.recipientReceives / amount
                            : rate.rate || rate.exchangeRate,
                        amountReceived:
                            rate.recipientReceives ||
                            (amount - (rate.fees || 0)) * (rate.rate || rate.exchangeRate || 1),
                        rateTime: new Date(data.data.timestamp).toLocaleTimeString(),
                        status: rate.status || "success",
                        provider: rate.provider || rate.service,
                        uniqueId: `${rate.provider || rate.service}-${index}-${data.data.timestamp || Date.now()}`,
                        updatedAt: data.data.timestamp || new Date().toISOString(),
                        apiSource: useCryptoAPI ? 'crypto' : 'fiat',
                        currencyTypes: currencyTypes,
                    }));

                    // Deduplicate by provider, keeping the most recent rate by updatedAt
                    const rateMap = new Map();
                    mappedRates.forEach((rate) => {
                        const provider = rate.provider;
                        const currentRate = rateMap.get(provider);
                        const rateTimestamp = new Date(rate.updatedAt).getTime();
                        const currentTimestamp = currentRate ? new Date(currentRate.updatedAt).getTime() : 0;
                        if (!currentRate || rateTimestamp > currentTimestamp) {
                            rateMap.set(provider, rate);
                        }
                    });
                    const deduplicatedRates = { data: Array.from(rateMap.values()) };

                    console.log("✅ Deduplicated rates set:", deduplicatedRates);
                    setFetchedRates(deduplicatedRates);

                    const successMessage = useCryptoAPI
                        ? "Crypto rates scraped successfully!"
                        : "Rates scraped successfully!";
                    toast.success(successMessage, { toastId: "scrape-rates-success" });
                } else {
                    throw new Error(data.error || "No valid rates data received");
                }
            } catch (error) {
                console.error("💥 Error scraping rates:", error);
                const errorMessage = useCryptoAPI
                    ? error.message || "Failed to scrape crypto rates. Please try again."
                    : error.message || "Failed to scrape rates. Please try again.";
                setError(errorMessage);
                toast.error(errorMessage, { toastId: "scrape-rates-error" });
            } finally {
                setIsLoadingAllRates(false);
            }
        },
        [isUserInteracted]
    );

    const findBestRate = useCallback(
        (ratesData, fromCurr, toCurr, amount, provider = null) => {
            if (!ratesData?.data) return null;
            const matchingRates = ratesData.data.filter(
                (rate) =>
                    rate.from_currency === fromCurr &&
                    rate.to_currency === toCurr &&
                    (!provider || rate.provider === provider)
            );
            if (matchingRates.length === 0) return null;
            matchingRates.sort((a, b) => new Date(b.updatedAt || b.updated_at).getTime() - new Date(a.updatedAt || a.updated_at).getTime());
            return matchingRates[0];
        },
        []
    );

    const getProvidersForCorridor = useCallback((ratesData, fromCurr, toCurr) => {
        if (!ratesData?.data) return [];
        const providers = ratesData.data
            .filter((rate) => rate.from_currency === fromCurr && rate.to_currency === toCurr)
            .map((rate) => rate.provider)
            .filter((provider, index, self) => self.indexOf(provider) === index);
        return providers;
    }, []);

    const fetchOrgRates = useCallback(
        async (orgId, orgName) => {
            try {
                setIsLoading(true);
                setError("");
                const { token, isTokenValid } = useAuthStore.getState();
                if (!token || !isTokenValid()) {
                    setError("Authentication required. Please log in.");
                    return;
                }
                const orgRatesData = await getExchangeRatesByOrg(token, orgId);
                console.log(`Rates for org ${orgName} (${orgId}):`, orgRatesData);
                if (orgRatesData?.status === "error") {
                    let errorMessage = orgRatesData.message || `Failed to fetch rates for ${orgName}.`;
                    if (orgRatesData.message?.includes("No rate configs found for organization")) {
                        errorMessage = `No rate configurations found for ${orgName} in ${fromCurrency} → ${toCurrency} pair.`;
                        setFetchedOrgRates((prev) => ({
                            ...prev,
                            [orgId]: { status: "success", data: [] },
                        }));
                    }
                    setError(errorMessage);
                    toast.warn(errorMessage, { toastId: `fetch-org-rates-error-${orgId}` });
                    return;
                }
                if (!orgRatesData || !orgRatesData.data) {
                    setError(`No rate data received for ${orgName}.`);
                    return;
                }
                setFetchedOrgRates((prev) => ({
                    ...prev,
                    [orgId]: orgRatesData,
                }));
                toast.success(`Rates fetched successfully for ${orgName}!`, {
                    toastId: `fetch-org-rates-${orgId}`,
                });
            } catch (error) {
                console.error(`Error fetching rates for ${orgName} (${orgId}):`, error);
                let errorMessage = error.message || `Failed to fetch rates for ${orgName}.`;
                if (error.message?.includes("No rate configs found for organization")) {
                    errorMessage = `No rate configurations found for ${orgName} in ${fromCurrency} → ${toCurrency} pair.`;
                    setFetchedOrgRates((prev) => ({
                        ...prev,
                        [orgId]: { status: "success", data: [] },
                    }));
                }
                setError(errorMessage);
                toast.warn(errorMessage, { toastId: `fetch-org-rates-error-${orgId}` });
            } finally {
                setIsLoading(false);
            }
        },
        [fromCurrency, toCurrency]
    );

    const fetchAllRates = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsLoadingAllRates(true);
            setError("");
            setFetchedRates(null);
            const { token, isTokenValid } = useAuthStore.getState();
            if (!token || !isTokenValid()) {
                setError("Authentication required. Please log in.");
                return;
            }
            const ratesData = await getExchangeRates();
            console.log("ratesData:", ratesData);
            if (!ratesData || !ratesData.data) {
                setError("No exchange rate data received from API.");
                return;
            }
            setFetchedRates(ratesData);
            toast.success("Exchange rates fetched successfully!", {
                toastId: "fetch-rates-success",
            });
        } catch (error) {
            console.error("Error fetching rates:", error);
            setError(error.message || "Failed to fetch rates from API.");
        } finally {
            setIsLoading(false);
            setIsLoadingAllRates(false);
        }
    }, []);

    const fetchOrgs = useCallback(async () => {
        try {
            setIsLoadingOrgs(true);
            setError("");
            const { token, isTokenValid } = useAuthStore.getState();
            if (!token || !isTokenValid()) {
                setError("Authentication required. Please log in.");
                return;
            }
            const orgsData = await getOrganizations(token);
            console.log("orgsData:", orgsData);
            if (!orgsData || !orgsData.data) {
                setError("No organization data received from API.");
                setFetchedOrgs({ data: { organizations: [] } });
                setIsDefaultOrgValid(false);
                return;
            }
            setFetchedOrgs(orgsData);
            const isDefaultValid = orgsData.data.organizations.some(
                (org) => org.org_name === defaultOrg.name || org.org_id === defaultOrg.id
            );
            setIsDefaultOrgValid(isDefaultValid);
            if (!isDefaultValid) {
                setError(`Default organization "${defaultOrg.name}" (ID: ${defaultOrg.id.slice(0, 8)}...) not found in available organizations.`);
                toast.warn(`Default organization "${defaultOrg.name}" not found in API response.`, {
                    toastId: "default-org-not-found",
                });
            }
        } catch (error) {
            console.error("Error fetching organizations:", error);
            setError(error.message || "Failed to fetch organizations.");
            setFetchedOrgs({ data: { organizations: [] } });
            setIsDefaultOrgValid(false);
        } finally {
            setIsLoadingOrgs(false);
        }
    }, [defaultOrg]);

    const handleManualLogin = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            await refreshPCXAuthToken();
            toast.success("Successfully refreshed authentication token!");
            await fetchOrgs();
            await fetchAllRates();
            await fetchOrgRates(defaultOrg.id, defaultOrg.name);
        } catch (error) {
            console.error("Manual login failed:", error);
            setError("Failed to authenticate. Please try again.");
            toast.error("Failed to authenticate. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, [fetchOrgs, fetchAllRates, defaultOrg]);

    useEffect(() => {
        setFetchedRates(null);
        setFetchedOrgRates({});
        getPCXAuthToken();
        fetchOrgs();
        fetchAllRates();
        fetchOrgRates(defaultOrg.id, defaultOrg.name);
    }, [fetchOrgs, fetchAllRates, defaultOrg]);

    useEffect(() => {
        setFetchedOrgRates({});
        if (selectedPCXOrg) {
            const selectedOrg = fetchedOrgs?.data?.organizations?.find(
                (org) => (org.org_name || org.org_id) === selectedPCXOrg
            );
            if (selectedOrg?.org_id) {
                fetchOrgRates(selectedOrg.org_id, selectedOrg.org_name);
            } else if (selectedPCXOrg === defaultOrg.name) {
                fetchOrgRates(defaultOrg.id, defaultOrg.name);
            }
        }
    }, [selectedPCXOrg, fetchedOrgs, fetchOrgRates, defaultOrg]);

    useEffect(() => {
        setFetchedRates(null);
        setFetchedOrgRates({});
        fetchAllRates();
        if (selectedPCXOrg) {
            const selectedOrg = fetchedOrgs?.data?.organizations?.find(
                (org) => (org.org_name || org.org_id) === selectedPCXOrg
            );
            if (selectedOrg?.org_id) {
                fetchOrgRates(selectedOrg.org_id, selectedOrg.org_name);
            } else if (selectedPCXOrg === defaultOrg.name) {
                fetchOrgRates(defaultOrg.id, defaultOrg.name);
            }
        }
    }, [fromCurrency, toCurrency, fetchAllRates, fetchOrgRates, fetchedOrgs, selectedPCXOrg, defaultOrg]);

    useEffect(() => {
        if (fetchedOrgs?.data?.organizations && fetchedOrgs.data.organizations.length > 0) {
            const configuredDefaultOrg = fetchedOrgs.data.organizations.find(
                (org) => org.org_name === defaultOrg.name || org.org_id === defaultOrg.id
            );
            if (configuredDefaultOrg && !selectedPCXOrg) {
                setSelectedPCXOrg(configuredDefaultOrg.org_name || configuredDefaultOrg.org_id);
                setIsDefaultOrgValid(true);
            } else if (!selectedPCXOrg) {
                setSelectedPCXOrg(fetchedOrgs.data.organizations[0].org_name || fetchedOrgs.data.organizations[0].org_id);
            }
        } else if (!selectedPCXOrg) {
            setSelectedPCXOrg(defaultOrg.name);
        }
    }, [fetchedOrgs, selectedPCXOrg, defaultOrg]);

    const enhancedRateData = useMemo(() => {
        const rateList = [];
        if (fetchedRates?.data) {
            const providers = getProvidersForCorridor(fetchedRates, fromCurrency, toCurrency);
            providers.forEach((provider) => {
                const bestRate = findBestRate(fetchedRates, fromCurrency, toCurrency, parseFloat(sendAmount), provider);
                if (bestRate) {
                    const finalRate = parseFloat(bestRate.rate);

                    rateList.push({
                        name: provider,
                        baseRate: finalRate,
                        spread: 0,
                        finalRate: finalRate,
                        status: "active",
                        type: "provider",
                        fee: 0,
                        lastUpdate: new Date(bestRate.updatedAt).toLocaleString(),
                        reliability: 99.0,
                        provider: provider,
                        rateId: bestRate.rate_id,
                        color: bestRate.apiSource === 'crypto' ? "#F59E0B" : "#10B981",
                        apiSource: bestRate.apiSource || 'unknown',
                    });
                }
            });
        }

        if (fetchedOrgs?.data?.organizations) {
            fetchedOrgs.data.organizations.forEach((org) => {
                const orgRates = fetchedOrgRates[org.org_id];
                let bestRate = orgRates
                    ? findBestRate(orgRates, fromCurrency, toCurrency, parseFloat(sendAmount))
                    : null;
                let computedRate = 0;
                let computedSpread = 0;
                let provider = "unknown";
                let updatedAt = org.updatedAt ? new Date(org.updatedAt).toLocaleString() : "Unknown";
                if (bestRate) {
                    provider = bestRate.provider;
                    computedSpread = bestRate.spread || 0;
                    updatedAt = new Date(bestRate.updated_at).toLocaleString();
                    const baseProviderRate = findBestRate(fetchedRates, fromCurrency, toCurrency, parseFloat(sendAmount), bestRate.provider);
                    const baseRate = baseProviderRate ? parseFloat(baseProviderRate.rate) : (isCryptocurrency(fromCurrency) || isCryptocurrency(toCurrency) ? 0.00000001 : 0.00046);
                    computedRate = baseRate * (1 + computedSpread / 100);
                }
                rateList.push({
                    name: `PCX: ${org.org_name}`,
                    baseRate: computedRate,
                    spread: computedSpread,
                    finalRate: computedRate,
                    status: bestRate ? (bestRate.active ? "active" : "inactive") : "unavailable",
                    type: "pcx",
                    fee: 0,
                    lastUpdate: updatedAt,
                    reliability: 99.9,
                    orgId: org.org_id,
                    provider: provider,
                    color: "#8B5CF6",
                    apiSource: 'pcx',
                });
            });
        }

        if (!fetchedOrgs?.data?.organizations ||
            !fetchedOrgs.data.organizations.find(org => org.org_name === defaultOrg.name || org.org_id === defaultOrg.id)) {
            const orgRates = fetchedOrgRates[defaultOrg.id];
            let bestRate = orgRates
                ? findBestRate(orgRates, fromCurrency, toCurrency, parseFloat(sendAmount))
                : null;
            let computedRate = 0;
            let computedSpread = 0;
            let provider = "unknown";
            let updatedAt = "Unknown";
            if (bestRate) {
                provider = bestRate.provider;
                computedSpread = bestRate.spread || 0;
                updatedAt = new Date(bestRate.updated_at).toLocaleString();
                const baseProviderRate = findBestRate(fetchedRates, fromCurrency, toCurrency, parseFloat(sendAmount), bestRate.provider);
                const baseRate = baseProviderRate ? parseFloat(baseProviderRate.rate) : (isCryptocurrency(fromCurrency) || isCryptocurrency(toCurrency) ? 0.00000001 : 0.00046);
                computedRate = baseRate * (1 + computedSpread / 100);
            }
            rateList.push({
                name: `PCX: ${defaultOrg.name}`,
                baseRate: computedRate,
                spread: computedSpread,
                finalRate: computedRate,
                status: bestRate ? (bestRate.active ? "active" : "inactive") : "unavailable",
                type: "pcx",
                fee: 0,
                lastUpdate: updatedAt,
                reliability: 99.9,
                orgId: defaultOrg.id,
                provider: provider,
                color: "#8B5CF6",
                apiSource: 'pcx',
            });
        }
        return rateList.sort((a, b) => b.finalRate - a.finalRate);
    }, [fetchedRates, fetchedOrgs, fetchedOrgRates, fromCurrency, toCurrency, sendAmount, findBestRate, getProvidersForCorridor, defaultOrg]);

    const currentPCXRate = useMemo(() => {
        if (!selectedPCXOrg) {
            return {
                baseRate: 0,
                spread: 0,
                finalRate: 0,
                status: "unavailable",
                fee: 0,
                lastUpdate: "N/A",
                provider: "unknown",
            };
        }
        const selectedOrg = fetchedOrgs?.data?.organizations?.find(
            (org) => (org.org_name || org.org_id) === selectedPCXOrg
        );
        let orgId = selectedOrg?.org_id;
        let updatedAt = selectedOrg?.updatedAt;
        if (!selectedOrg && selectedPCXOrg === defaultOrg.name) {
            orgId = defaultOrg.id;
            updatedAt = null;
        }
        if (!orgId) {
            return {
                baseRate: 0,
                spread: 0,
                finalRate: 0,
                status: "unavailable",
                fee: 0,
                lastUpdate: "N/A",
                provider: "unknown",
            };
        }
        const orgRates = fetchedOrgRates[orgId];
        let bestRate = orgRates
            ? findBestRate(orgRates, fromCurrency, toCurrency, parseFloat(sendAmount))
            : null;
        let computedRate = 0;
        let computedSpread = 0;
        let provider = "unknown";
        let lastUpdate = updatedAt ? new Date(updatedAt).toLocaleString() : "N/A";
        if (bestRate) {
            provider = bestRate.provider;
            computedSpread = bestRate.spread || 0;
            lastUpdate = new Date(bestRate.updated_at).toLocaleString();
            const baseProviderRate = findBestRate(fetchedRates, fromCurrency, toCurrency, parseFloat(sendAmount), bestRate.provider);
            const baseRate = baseProviderRate ? parseFloat(baseProviderRate.rate) : (isCryptocurrency(fromCurrency) || isCryptocurrency(toCurrency) ? 0.00000001 : 0.00046);
            computedRate = baseRate * (1 + computedSpread / 100);
        }
        return {
            baseRate: computedRate,
            spread: computedSpread,
            finalRate: computedRate,
            status: bestRate ? (bestRate.active ? "active" : "inactive") : "unavailable",
            fee: 0,
            lastUpdate: lastUpdate,
            provider: provider,
        };
    }, [fetchedOrgs, selectedPCXOrg, fetchedOrgRates, fromCurrency, toCurrency, sendAmount, findBestRate, defaultOrg]);

    const adjustedRate = currentPCXRate.finalRate + spreadAdjustment;
    const benchmarkList = enhancedRateData;
    const isCurrentCorridorCrypto = useMemo(() => shouldUseCryptoAPI(fromCurrency, toCurrency), [fromCurrency, toCurrency]);

    const fetchRates = useCallback(() => {
        setIsLoading(true);
        setFetchedRates(null);
        fetchAllRates();
        setTimeout(() => setIsLoading(false), 1500);
    }, [fetchAllRates]);

    const formatNumber = useCallback((num) => {
        const numValue = parseFloat(num) || 0;
        return new Intl.NumberFormat("en-US", {
            minimumFractionDigits: isCurrentCorridorCrypto ? 8 : 4,
            maximumFractionDigits: isCurrentCorridorCrypto ? 8 : 4,
        }).format(numValue);
    }, [isCurrentCorridorCrypto]);

    const formatCurrency = useCallback((amount, currency = "USD") => {
        const numValue = parseFloat(amount) || 0;
        return new Intl.NumberFormat("en-US", {
            style: isFiatCurrency(currency) ? "currency" : "decimal",
            currency: isFiatCurrency(currency) ? currency : undefined,
            minimumFractionDigits: isCurrentCorridorCrypto ? 8 : 4,
            maximumFractionDigits: isCurrentCorridorCrypto ? 8 : 4,
        }).format(numValue) + (isFiatCurrency(currency) ? "" : ` ${currency}`);
    }, [isCurrentCorridorCrypto]);

    const getPositionForRate = useCallback(
        (rate) => {
            const sortedList = [...benchmarkList].sort((a, b) => b.finalRate - a.finalRate);
            return sortedList.findIndex((item) => Math.abs(item.finalRate - rate) < (isCurrentCorridorCrypto ? 0.00000001 : 0.00001)) + 1;
        },
        [benchmarkList, isCurrentCorridorCrypto]
    );

    const handleAmountChange = useCallback((value) => {
        const cleanValue = value.replace(/[^0-9.]/g, "");
        if (cleanValue === "" || /^\d*\.?\d*$/.test(cleanValue)) {
            setSendAmount(cleanValue);
        }
    }, []);

    const adjustSpread = useCallback((delta) => {
        setSpreadAdjustment((prev) => Math.round((prev + delta) * 100000000) / 100000000);
    }, []);

    const chartData = useMemo(() => {
        return benchmarkList.map((item) => ({
            ...item,
            displayRate: item.finalRate,
        }));
    }, [benchmarkList]);

    useEffect(() => {
        const handleInteraction = () => setIsUserInteracted(true);
        window.addEventListener('click', handleInteraction);
        return () => window.removeEventListener('click', handleInteraction);
    }, []);

    useEffect(() => {
        console.log("fetchedOrgs:", fetchedOrgs);
        console.log("selectedPCXOrg:", selectedPCXOrg);
        console.log("defaultOrg:", defaultOrg);
        console.log("isDefaultOrgValid:", isDefaultOrgValid);
        console.log("enhancedRateData:", enhancedRateData);
        console.log("chartData:", chartData);
        console.log("currentPCXRate:", currentPCXRate);
        console.log("fetchedOrgRates:", fetchedOrgRates);
        console.log("fetchedRates:", fetchedRates);
    }, [fetchedOrgs, selectedPCXOrg, defaultOrg, isDefaultOrgValid, enhancedRateData, chartData, currentPCXRate, fetchedOrgRates, fetchedRates]);

    return (
        <div className="min-h-screen mt-10 bg-gray-50">
            <Header
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                setShowSettings={setShowSettings}
                showSettings={showSettings}
                fetchRates={fetchRates}
                isLoading={isLoading}
                ScrapeRates={ScrapeRates}
                isLoadingAllRates={isLoadingAllRates}
                fromCurrency={fromCurrency}
                toCurrency={toCurrency}
                sendAmount={sendAmount}
                isCurrentCorridorCrypto={isCurrentCorridorCrypto}
                error={error}
                handleManualLogin={handleManualLogin}
                defaultOrg={defaultOrg}
                isDefaultOrgValid={isDefaultOrgValid}
            />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <SettingsPanel
                    showSettings={showSettings}
                    setShowSettings={setShowSettings}
                    defaultOrg={defaultOrg}
                    setDefaultOrg={setDefaultOrg}
                    fetchedOrgs={fetchedOrgs}
                    isDefaultOrgValid={isDefaultOrgValid}
                    setSelectedPCXOrg={setSelectedPCXOrg}
                    setFetchedOrgRates={setFetchedOrgRates}
                    fetchOrgRates={fetchOrgRates}
                />
                {/* <RateDiagnostic
                    combinedRates={combinedRates}
                    fromCurrency={fromCurrency}
                    toCurrency={toCurrency}
                    sendAmount={sendAmount}
                /> */}
                <ErrorMessage error={error} />
                <InputSection
                    sendAmount={sendAmount}
                    handleAmountChange={handleAmountChange}
                    fromCurrency={fromCurrency}
                    setFromCurrency={setFromCurrency}
                    toCurrency={toCurrency}
                    setToCurrency={setToCurrency}
                    selectedPCXOrg={selectedPCXOrg}
                    setSelectedPCXOrg={setSelectedPCXOrg}
                    isLoadingOrgs={isLoadingOrgs}
                    fetchedOrgs={fetchedOrgs}
                    formatCurrency={formatCurrency}
                    defaultOrg={defaultOrg}
                    isDefaultOrgValid={isDefaultOrgValid}
                    isCurrentCorridorCrypto={isCurrentCorridorCrypto}
                    currentPCXRate={currentPCXRate}
                    adjustedRate={adjustedRate}
                    getPositionForRate={getPositionForRate}
                    benchmarkList={benchmarkList}
                    spreadAdjustment={spreadAdjustment}
                    setSpreadAdjustment={setSpreadAdjustment}
                    adjustSpread={adjustSpread}
                    isFiatCurrency={isFiatCurrency}
                    isCryptocurrency={isCryptocurrency}
                />
                <LiveProviderRates
                    fetchedRates={fetchedRates}
                    fetchedOrgRates={fetchedOrgRates}
                    fromCurrency={fromCurrency}
                    toCurrency={toCurrency}
                    getProvidersForCorridor={getProvidersForCorridor}
                    findBestRate={findBestRate}
                    sendAmount={sendAmount}
                    isCurrentCorridorCrypto={isCurrentCorridorCrypto}
                    formatNumber={formatNumber}
                />
                {activeTab === "benchmark" && (
                    <BenchmarkTable
                        benchmarkList={benchmarkList}
                        fromCurrency={fromCurrency}
                        selectedPCXOrg={selectedPCXOrg}
                        adjustedRate={adjustedRate}
                        isCurrentCorridorCrypto={isCurrentCorridorCrypto}
                        sendAmount={sendAmount}
                        formatCurrency={formatCurrency}
                        toCurrency={toCurrency}
                        getPositionForRate={getPositionForRate}
                        calculateRecipientAmount={calculateRecipientAmount}
                    />
                )}
                {activeTab === "comparison" && (
                    <ComparisonChart
                        chartData={chartData}
                        fromCurrency={fromCurrency}
                        toCurrency={toCurrency}
                        sendAmount={sendAmount}
                        isLoadingAllRates={isLoadingAllRates}
                        isCurrentCorridorCrypto={isCurrentCorridorCrypto}
                        formatCurrency={formatCurrency}
                    />
                )}
                {activeTab === "simulator" && (
                    <Simulator
                        isCurrentCorridorCrypto={isCurrentCorridorCrypto}
                        currentPCXRate={currentPCXRate}
                        spreadAdjustment={spreadAdjustment}
                        setSpreadAdjustment={setSpreadAdjustment}
                        getPositionForRate={getPositionForRate}
                        benchmarkList={benchmarkList}
                        adjustedRate={adjustedRate}
                        sendAmount={sendAmount}
                        formatCurrency={formatCurrency}
                        fromCurrency={fromCurrency}
                        toCurrency={toCurrency}
                    />
                )}
            </div>
            <ToastContainer />
        </div>
    );
}