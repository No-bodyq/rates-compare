"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronDown, Loader, TrendingUp, AlertCircle, RefreshCw, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import map from "lodash/map";

// Currency map
const currencyMap = {
    USD: { flag: "🇺🇸", country: "United States" },
    EUR: { flag: "🇪🇺", country: "European Union" },
    GBP: { flag: "🇬🇧", country: "United Kingdom" },
    JPY: { flag: "🇯🇵", country: "Japan" },
    CAD: { flag: "🇨🇦", country: "Canada" },
    AUD: { flag: "🇦🇺", country: "Australia" },
    CHF: { flag: "🇨🇭", country: "Switzerland" },
    CNY: { flag: "🇨🇳", country: "China" },
    KES: { flag: "🇰🇪", country: "Kenya" },
    NGN: { flag: "🇳🇬", country: "Nigeria" },
    ZAR: { flag: "🇿🇦", country: "South Africa" },
    INR: { flag: "🇮🇳", country: "India" },
};

// Split currencies into source (send) and target (receive)
const sourceCurrencies = ['USD', 'EUR', 'GBP']; // Only these 3 for sending
const targetCurrencies = Object.keys(currencyMap).filter(currency =>
    !sourceCurrencies.includes(currency)
); // All others for receiving

const supportedCurrencies = Object.keys(currencyMap); // Keep this for backward compatibility

// Mock FormattedCurrencyInput component
const FormattedCurrencyInput = ({ value, onChange, placeholder, className, disabled }) => (
    <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        min="0"
        step="0.01"
    />
);

// Debounce helper function
const debounce = (func, wait) => {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
};

// Helper function to calculate best rate
const getBestRate = (rates) => {
    const successRates = rates.filter((rate) => rate.status === "success" && !isNaN(rate.amountReceived));
    if (successRates.length === 0) return null;

    return successRates.reduce((best, current) =>
        current.amountReceived > best.amountReceived ? current : best
    );
};

// Helper function to calculate rate comparison
const getRateComparison = (rates) => {
    const successRates = rates.filter((rate) => rate.status === "success" && !isNaN(rate.amountReceived));
    if (successRates.length < 2) return null;

    const amounts = successRates.map((rate) => rate.amountReceived);
    const best = Math.max(...amounts);
    const worst = Math.min(...amounts);

    return {
        best: successRates.find((rate) => rate.amountReceived === best),
        worst: successRates.find((rate) => rate.amountReceived === worst),
        savings: best - worst,
        savingsPercent: ((best - worst) / worst) * 100,
    };
};

function Send() {
    const router = useRouter();

    // State
    const [activeView, setActiveView] = useState("send");
    const [rate, setRate] = useState(null);
    const [isLoadingRate, setIsLoadingRate] = useState(false);
    const [baseValue, setBaseValue] = useState("");
    const [targetValue, setTargetValue] = useState("");
    const [sourceCurrency, setSourceCurrency] = useState("USD");
    const [targetCurrency, setTargetCurrency] = useState("");
    const [showSourceList, setShowSourceList] = useState(false);
    const [showTargetList, setShowTargetList] = useState(false);
    const [error, setError] = useState("");
    const [allRates, setAllRates] = useState([]);
    const [isLoadingAllRates, setIsLoadingAllRates] = useState(false);
    const [bestRate, setBestRate] = useState(null);
    const [rateComparison, setRateComparison] = useState(null);
    const [lastRateUpdate, setLastRateUpdate] = useState(null);
    const [lastEditedField, setLastEditedField] = useState(null);
    const [isUserInteracted, setIsUserInteracted] = useState(false);

    // Refs
    const sourceCurrencyRef = useRef(sourceCurrency);
    const targetCurrencyRef = useRef(targetCurrency);
    const rateRequestInProgress = useRef(false);
    const currentRequestRef = useRef(null);
    const debouncedFetchRef = useRef(null);
    const baseValueRef = useRef(baseValue);

    // Update refs
    useEffect(() => {
        sourceCurrencyRef.current = sourceCurrency;
        targetCurrencyRef.current = targetCurrency;
    }, [sourceCurrency, targetCurrency]);

    // API call to fetch exchange rate
    const fetchExchangeRate = useCallback(
        async (base, target, amount) => {
            if (!base || !target) {
                console.log("🚫 fetchExchangeRate skipped: missing base or target currency");
                setError("Please select both source and recipient currencies");
                setIsLoadingRate(false);
                return;
            }
            if (!isUserInteracted || !amount) {
                console.log("🚫 fetchExchangeRate skipped: missing amount or user interaction");
                setIsLoadingRate(false);
                return;
            }

            if (base === target) {
                setIsLoadingRate(false);
                setRate(1);
                if (lastEditedField === "base") {
                    setTargetValue(baseValueRef.current);
                } else if (lastEditedField === "target") {
                    setBaseValue(targetValue);
                    baseValueRef.current = targetValue;
                }
                return;
            }

            rateRequestInProgress.current = true;
            setIsLoadingRate(true);

            const requestId = Date.now();
            currentRequestRef.current = requestId;

            try {
                console.log(`🔄 Fetching exchange rate: ${base} → ${target} (${amount})`);

                const response = await fetch(
                    `/api/scrape-rates?base=${base}&target=${target}&amount=${amount}&sendwave=true`
                );
                const data = await response.json();
                console.log("📥 fetchExchangeRate response:", data);

                if (requestId !== currentRequestRef.current) {
                    console.log("🚫 Request outdated, ignoring result");
                    return;
                }

                if (data.success && data.data.rates.length > 0) {
                    const rateData = data.data.rates[0]; // Assuming Sendwave rate
                    const newRate = rateData.recipientReceives ? rateData.recipientReceives / amount : rateData.rate || rateData.exchangeRate;
                    console.log("✅ Exchange rate set:", newRate);
                    setRate(newRate);

                    const currentAmount = parseFloat(baseValueRef.current) || 0;
                    if (currentAmount && lastEditedField === "base") {
                        const calculated = parseFloat(newRate) * currentAmount;
                        setTargetValue(isNaN(calculated) ? "" : calculated.toFixed(2));
                    } else if (targetValue && lastEditedField === "target") {
                        const calculatedBase = parseFloat(targetValue) / parseFloat(newRate);
                        const formattedBase = isNaN(calculatedBase) ? "" : calculatedBase.toFixed(2);
                        setBaseValue(formattedBase);
                        baseValueRef.current = formattedBase;
                    }
                } else {
                    // console.warn("❌ No valid exchange rate available:", data.errors);
                    console.log('data>>>>', data)
                    setRate(null);
                    setError(data.errors || "Failed to fetch exchange rate");
                }
            } catch (error) {
                if (requestId === currentRequestRef.current) {
                    console.error("❌ Error fetching exchange rate:", error);
                    setRate(null);
                    setError("Failed to fetch exchange rate");
                }
            } finally {
                if (requestId === currentRequestRef.current) {
                    setIsLoadingRate(false);
                    rateRequestInProgress.current = false;
                }
            }
        },
        [lastEditedField, targetValue, isUserInteracted]
    );

    // API call to fetch all rates
    const fetchAllRates = useCallback(
        async (base, target, amount) => {
            if (!base || !target) {
                console.log("🚫 fetchAllRates skipped: missing base or target currency");
                setError("Please select both source and recipient currencies");
                setIsLoadingAllRates(false);
                return;
            }
            if (!isUserInteracted || !amount) {
                console.log("🚫 fetchAllRates skipped: missing amount or user interaction");
                setIsLoadingAllRates(false);
                return;
            }

            setIsLoadingAllRates(true);
            try {
                console.log(`🔄 Fetching all rates: ${base} → ${target} (${amount})`);

                const response = await fetch(
                    `/api/scrape-rates?base=${base}&target=${target}&amount=${amount}`
                );
                const data = await response.json();
                console.log("📥 fetchAllRates response:", data);

                if (data.success && data.data.rates) {
                    const rates = data.data.rates.map((rate, index) => ({
                        ...rate,
                        exchangeRate: rate.recipientReceives ? rate.recipientReceives / amount : rate.rate || rate.exchangeRate,
                        amountReceived: rate.recipientReceives || (amount - (rate.fees || 0)) * (rate.rate || rate.exchangeRate || 1),
                        rateTime: new Date(data.data.timestamp).toLocaleTimeString(),
                        status: rate.status || "success",
                        provider: rate.provider || rate.service,
                        uniqueId: `${rate.provider || rate.service}-${index}-${data.data.timestamp || Date.now()}`,
                    }));
                    console.log("✅ Rates set:", rates);
                    setAllRates(rates);
                    const best = getBestRate(rates);
                    setBestRate(best);
                    console.log("✅ Best rate:", best);
                    const comparison = getRateComparison(rates);
                    setRateComparison(comparison);
                    console.log("✅ Rate comparison:", comparison);
                    setLastRateUpdate(new Date(data.data.timestamp));
                } else {
                    throw new Error(data.error || "Failed to fetch rates");
                }
            } catch (error) {
                console.error("💥 Error fetching all rates:", error);
                setAllRates([]);
                setBestRate(null);
                setRateComparison(null);
                setError(error.message || "Failed to fetch rates");
            } finally {
                setIsLoadingAllRates(false);
            }
        },
        [isUserInteracted]
    );

    // Initialize debounced fetch
    useEffect(() => {
        debouncedFetchRef.current = debounce((base, target, amount) => {
            fetchExchangeRate(base, target, amount);
        }, 1000);
    }, [fetchExchangeRate]);

    // Auto-fetch all rates when currency pair changes
    useEffect(() => {
        if (
            sourceCurrency &&
            targetCurrency &&
            sourceCurrency !== targetCurrency &&
            isUserInteracted &&
            baseValue
        ) {
            const amount = parseFloat(baseValue) || 1000;
            console.log("🔄 Triggering fetchAllRates in useEffect");
            fetchAllRates(sourceCurrency, targetCurrency, amount);
        } else if (!sourceCurrency || !targetCurrency) {
            setError("Please select both source and recipient currencies");
        }
    }, [sourceCurrency, targetCurrency, baseValue, isUserInteracted, fetchAllRates]);

    // Keep baseValueRef updated
    useEffect(() => {
        baseValueRef.current = baseValue;
    }, [baseValue]);

    // Handle source currency change
    const handleSourceCurrencyChange = (currency) => {
        console.log(`💰 Source currency changed to: ${currency}`);
        setShowSourceList(false);
        setIsLoadingRate(true);
        setRate(null);
        setTargetValue("");
        setSourceCurrency(currency);
        sourceCurrencyRef.current = currency;
        setIsUserInteracted(true);

        if (!targetCurrency) {
            setError("Please select a recipient currency");
            setIsLoadingRate(false);
            return;
        }

        if (currency === targetCurrency) {
            setIsLoadingRate(false);
            setRate(1);
            if (baseValue) {
                setTargetValue(baseValue);
            }
            setLastEditedField("base");
        } else if (baseValue) {
            setLastEditedField("base");
            fetchExchangeRate(currency, targetCurrency, baseValue);
            const amount = parseFloat(baseValue) || 1000;
            fetchAllRates(currency, targetCurrency, amount);
        }
    };

    // Handle target currency change
    const handleTargetCurrencyChange = (currency) => {
        console.log(`💱 Target currency changed to: ${currency}`);
        setShowTargetList(false);
        setIsLoadingRate(true);
        setRate(null);
        setTargetValue("");
        setTargetCurrency(currency);
        targetCurrencyRef.current = currency;
        setIsUserInteracted(true);

        if (!sourceCurrency) {
            setError("Please select a source currency");
            setIsLoadingRate(false);
            return;
        }

        if (sourceCurrency === currency) {
            setIsLoadingRate(false);
            setRate(1);
            if (baseValue) {
                setTargetValue(baseValue);
            }
            setLastEditedField("base");
        } else if (baseValue) {
            setLastEditedField("base");
            fetchExchangeRate(sourceCurrency, currency, baseValue);
            const amount = parseFloat(baseValue) || 1000;
            fetchAllRates(sourceCurrency, currency, amount);
        }
    };

    // Currency swap function
    const handleCurrencySwap = () => {
        if (!sourceCurrency || !targetCurrency) {
            setError("Please select both source and recipient currencies");
            return;
        }

        // Check if swap is allowed (source must be in sourceCurrencies, target in targetCurrencies)
        if (!targetCurrencies.includes(sourceCurrency) || !sourceCurrencies.includes(targetCurrency)) {
            setError("Currency swap not allowed. Source must be USD, EUR, or GBP.");
            return;
        }

        console.log(`🔄 Swapping currencies: ${sourceCurrency} ↔ ${targetCurrency}`);
        const tempSource = sourceCurrency;
        const tempTarget = targetCurrency;
        const tempBaseValue = baseValue;
        const tempTargetValue = targetValue;

        setSourceCurrency(tempTarget);
        setTargetCurrency(tempSource);
        setBaseValue(tempTargetValue);
        setTargetValue(tempBaseValue);

        sourceCurrencyRef.current = tempTarget;
        targetCurrencyRef.current = tempSource;
        baseValueRef.current = tempTargetValue;

        setLastEditedField("base");
        setIsUserInteracted(true);

        if (tempTarget !== tempSource && tempTargetValue) {
            fetchExchangeRate(tempTarget, tempSource, tempTargetValue);
            const amount = parseFloat(tempTargetValue) || 1000;
            fetchAllRates(tempTarget, tempSource, amount);
        }
    };

    // Effect to fetch rate when currencies or baseValue change
    useEffect(() => {
        if (
            !sourceCurrency ||
            !targetCurrency ||
            !baseValue ||
            !isUserInteracted ||
            rateRequestInProgress.current
        ) {
            if (!sourceCurrency || !targetCurrency) {
                setError("Please select both source and recipient currencies");
            }
            return;
        }
        console.log("🔄 Triggering debounced fetchExchangeRate");
        debouncedFetchRef.current(sourceCurrency, targetCurrency, baseValue);
    }, [sourceCurrency, targetCurrency, baseValue, isUserInteracted]);

    // Clear error when rate is set
    useEffect(() => {
        if (rate !== null && error) {
            setError("");
        }
    }, [rate, error]);

    // Handle base value change
    const handleBaseChange = (newValue) => {
        if (error) setError("");
        setLastEditedField("base");
        setBaseValue(newValue);
        baseValueRef.current = newValue;
        setIsUserInteracted(true);

        if (!sourceCurrency || !targetCurrency) {
            setError("Please select both source and recipient currencies");
            return;
        }

        if (rate && !isLoadingRate && !rateRequestInProgress.current && newValue !== "") {
            const calculated = parseFloat(rate) * parseFloat(newValue);
            setTargetValue(isNaN(calculated) ? "" : calculated.toFixed(2));
        } else if (newValue === "") {
            setTargetValue("");
        }

        if (
            sourceCurrency &&
            targetCurrency &&
            sourceCurrency !== targetCurrency &&
            newValue &&
            isUserInteracted
        ) {
            const amount = parseFloat(newValue) || 1000;
            fetchAllRates(sourceCurrency, targetCurrency, amount);
        }
    };

    // Handle target value change
    const handleTargetChange = (newValue) => {
        if (error) setError("");
        setLastEditedField("target");
        setTargetValue(newValue);
        setIsUserInteracted(true);

        if (!sourceCurrency || !targetCurrency) {
            setError("Please select both source and recipient currencies");
            return;
        }

        if (rate && !isLoadingRate && !rateRequestInProgress.current && newValue !== "") {
            const calculatedBase = parseFloat(newValue) / parseFloat(rate);
            const formattedBase = isNaN(calculatedBase) ? "" : calculatedBase.toFixed(2);
            setBaseValue(formattedBase);
            baseValueRef.current = formattedBase;
        } else if (newValue === "") {
            setBaseValue("");
            baseValueRef.current = "";
        }
    };

    // Handle continue button with amount validation
    const handleContinue = () => {
        if (!sourceCurrency || !targetCurrency) {
            setError("Please select both source and recipient currencies");
            return;
        }
        if (!baseValue || parseFloat(baseValue) <= 0 || isNaN(parseFloat(baseValue))) {
            setError(`Please enter a valid amount for ${sourceCurrency}`);
            return;
        }

        const finalRate = rate || (bestRate ? bestRate.exchangeRate : 1);
        const finalTargetValue = targetValue || (baseValue && finalRate ? (parseFloat(baseValue) * finalRate).toFixed(2) : "0");

        console.log("✅ Continuing with:", {
            amount: baseValue,
            target_amount: finalTargetValue,
            target_currency: targetCurrency,
            currency: sourceCurrency,
            rate: finalRate,
        });

        router.push("/beneficiary");
    };

    // Manual refresh function
    const handleRefreshRates = async () => {
        if (
            sourceCurrency &&
            targetCurrency &&
            sourceCurrency !== targetCurrency &&
            isUserInteracted &&
            baseValue
        ) {
            console.log("🔄 Manual refresh triggered");
            const amount = parseFloat(baseValue) || 1000;
            await fetchAllRates(sourceCurrency, targetCurrency, amount);
        } else {
            setError("Please select both source and recipient currencies");
        }
    };

    // Test specific service
    const testSpecificService = async (serviceName) => {
        if (!sourceCurrency || !targetCurrency || sourceCurrency === targetCurrency || !isUserInteracted) {
            setError("Please select both source and recipient currencies");
            return;
        }

        console.log(`🧪 Testing ${serviceName}...`);
        const amount = parseFloat(baseValue) || 1000;

        try {
            const response = await fetch("/api/scrape-rates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    base: sourceCurrency,
                    target: targetCurrency,
                    amount,
                    sendwaveOnly: serviceName === "sendwave",
                }),
            });
            const data = await response.json();
            console.log(`✅ ${serviceName} test result:`, data);
            return data;
        } catch (error) {
            console.error(`❌ ${serviceName} test failed:`, error);
            setError("Failed to test service");
        }
    };

    // Initial rate fetch
    useEffect(() => {
        if (
            sourceCurrency &&
            targetCurrency &&
            !rate &&
            !rateRequestInProgress.current &&
            sourceCurrency !== targetCurrency &&
            isUserInteracted &&
            baseValue
        ) {
            console.log("🔄 Initial rate fetch triggered");
            setLastEditedField("base");
            fetchExchangeRate(sourceCurrency, targetCurrency, baseValue);
        } else if (!sourceCurrency || !targetCurrency) {
            setError("Please select both source and recipient currencies");
        }
    }, [sourceCurrency, targetCurrency, baseValue, isUserInteracted, rate, fetchExchangeRate]);

    // Log state for debugging
    useEffect(() => {
        console.log("🛠️ State debug:", { allRates, bestRate, rateComparison, rate, isLoadingAllRates, targetCurrency });
    }, [allRates, bestRate, rateComparison, rate, isLoadingAllRates, targetCurrency]);

    // Determine if continue button is disabled
    const isContinueDisabled =
        isLoadingRate ||
        rateRequestInProgress.current ||
        !baseValue ||
        parseFloat(baseValue) <= 0 ||
        !sourceCurrency ||
        !targetCurrency ||
        error !== "";

    // Check if swap is allowed
    const isSwapAllowed = sourceCurrencies.includes(targetCurrency) && targetCurrencies.includes(sourceCurrency);

    // Render rates comparison view
    const renderRatesComparison = () => {
        console.log("🎨 Rendering rates comparison:", { allRates, bestRate, rateComparison });

        return (
            <div className="w-full h-2/3 flex flex-col gap-5 p-10 rounded-xl bg-white">
                <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
                    <button
                        onClick={() => setActiveView("send")}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeView === "send" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"
                            }`}
                    >
                        Rate Calculator
                    </button>
                    <button
                        onClick={() => setActiveView("rates")}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeView === "rates" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"
                            }`}
                    >
                        Compare Rates
                    </button>
                </div>

                <div className="flex text-gray-900 justify-between items-center mb-6">
                    <div className="flex-1 relative">
                        <p className="text-sm text-gray-900 mb-2">When sending</p>
                        <div
                            className="flex items-center gap-2 bg-gray-100 rounded-lg p-3 cursor-pointer hover:bg-gray-200 transition-colors"
                            onClick={() => setShowSourceList(true)}
                        >
                            <span className="text-2xl">{currencyMap[sourceCurrency]?.flag}</span>
                            <span className="font-semibold">{baseValue || "1000"} {sourceCurrency}</span>
                            <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                        </div>
                        {showSourceList && (
                            <div className="absolute left-0 mt-1 w-64 border border-gray-200 rounded-md bg-white shadow-lg z-30 max-h-48 overflow-y-auto">
                                {map(sourceCurrencies, (currency) => (
                                    <div
                                        key={currency}
                                        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleSourceCurrencyChange(currency)}
                                    >
                                        <span className="text-xl">{currencyMap[currency]?.flag}</span>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{currency}</span>
                                            <span className="text-xs text-gray-500">{currencyMap[currency]?.country}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-center mx-4">
                        <button
                            onClick={handleCurrencySwap}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isSwapAllowed
                                ? "bg-gray-200 hover:bg-gray-300 cursor-pointer"
                                : "bg-gray-100 cursor-not-allowed opacity-50"
                                }`}
                            title={isSwapAllowed ? "Swap currencies" : "Swap not available for this currency pair"}
                            disabled={!isSwapAllowed}
                        >
                            <ArrowUpDown className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                    <div className="flex-1 relative">
                        <p className="text-sm text-gray-600 mb-2">Choose currency</p>
                        <div
                            className="flex items-center gap-2 bg-gray-100 rounded-lg p-3 cursor-pointer hover:bg-gray-200 transition-colors"
                            onClick={() => setShowTargetList(true)}
                        >
                            <span className="text-2xl">{currencyMap[targetCurrency]?.flag || "🌐"}</span>
                            <span className="font-semibold">{targetCurrency || "Select Currency"}</span>
                            <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                        </div>
                        {showTargetList && (
                            <div className="absolute right-0 mt-1 w-64 border rounded-md bg-white shadow-lg z-30 max-h-48 overflow-y-auto">
                                {map(targetCurrencies, (currency) => (
                                    <div
                                        key={currency}
                                        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleTargetCurrencyChange(currency)}
                                    >
                                        <span className="text-xl">{currencyMap[currency]?.flag}</span>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{currency}</span>
                                            <span className="text-xs text-gray-500">{currencyMap[currency]?.country}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Live Exchange Rates</h2>
                        <p className="text-sm text-gray-600">
                            {lastRateUpdate ? `Last updated: ${lastRateUpdate.toLocaleTimeString()}` : "Fetching latest rates..."}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleRefreshRates}
                            disabled={isLoadingAllRates || !isUserInteracted || !sourceCurrency || !targetCurrency}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoadingAllRates ? "animate-spin" : ""}`} />
                            Refresh
                        </button>
                        <button
                            onClick={() => testSpecificService("wise")}
                            className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            disabled={!isUserInteracted || !sourceCurrency || !targetCurrency}
                        >
                            Test Wise
                        </button>
                    </div>
                </div>

                {bestRate && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            <span className="font-semibold text-green-800">Best Rate Found</span>
                        </div>
                        <p className="text-green-700">
                            <strong>{bestRate.provider}</strong>: {bestRate.amountReceived.toLocaleString()} {targetCurrency}
                            {rateComparison && rateComparison.savings > 0 && (
                                <span className="ml-2 text-sm">
                                    (Save {rateComparison.savings.toFixed(2)} {targetCurrency} vs worst rate -{" "}
                                    {rateComparison.savingsPercent.toFixed(1)}% better)
                                </span>
                            )}
                        </p>
                    </div>
                )}

                <div className="space-y-4 overflow-y-auto" style={{ minHeight: "300px" }}>
                    {isLoadingAllRates ? (
                        <div className="flex items-center justify-center py-8 text-blue-600">
                            <Loader className="w-6 h-6 animate-spin mr-2" />
                            <span>Fetching rates (this may take up to 30 seconds)...</span>
                        </div>
                    ) : allRates.length > 0 ? (
                        allRates.map((rateData, index) => {
                            if (rateData.status !== "success" || isNaN(rateData.amountReceived)) {
                                return null;
                            }
                            return (
                                <div
                                    key={rateData.uniqueId || `${rateData.provider}-${index}`}
                                    className={`flex justify-between items-center p-4 rounded-lg transition-colors min-h-[60px] ${rateData.provider === bestRate?.provider ? "bg-green-50 border-2 border-green-200" : "bg-gray-50 hover:bg-gray-100"
                                        }`}
                                    style={{ display: "flex", visibility: "visible" }}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{rateData.logo || "💱"}</span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-gray-800">{rateData.provider}</p>
                                                {rateData.provider === bestRate?.provider && (
                                                    <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">BEST</span>
                                                )}
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                                    {rateData.sourceType || "API"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500">{rateData.rateTime}</p>
                                            {rateData.fees > 0 && (
                                                <p className="text-xs text-orange-600">
                                                    Fees: {rateData.fees.toFixed(2)} {rateData.fromCurrency || sourceCurrency}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-lg font-bold ${rateData.provider === bestRate?.provider ? "text-green-600" : "text-gray-800"}`}>
                                            {rateData.amountReceived.toLocaleString()} {targetCurrency}
                                        </p>
                                        <p className="text-xs text-gray-500">Rate: {rateData.exchangeRate.toFixed(4)}</p>
                                        {rateData.provider !== bestRate?.provider && rateComparison && rateComparison.savings > 0 && (
                                            <p className="text-xs text-red-500">
                                                -{(rateComparison.best.amountReceived - rateData.amountReceived).toFixed(2)} vs best
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex items-center justify-center py-8 text-gray-500">
                            <AlertCircle className="w-6 h-6 mr-2" />
                            <span>No rates available. Please select currencies and an amount, then try again.</span>
                        </div>
                    )}

                    {allRates
                        .filter((rate) => rate.status === "error")
                        .map((errorRate, index) => (
                            <div key={`error-${errorRate.provider}-${index}`} className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">❌</span>
                                    <div>
                                        <p className="font-semibold text-red-800">{errorRate.provider}</p>
                                        <p className="text-xs text-red-600">{errorRate.error}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-red-600">Unavailable</p>
                                </div>
                            </div>
                        ))}
                </div>

                <div className="mt-6">
                    <button
                        onClick={() => setActiveView("send")}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-3 transition-colors"
                    >
                        Back to Send
                    </button>
                </div>
            </div>
        );
    };

    // Render send form
    const renderSendForm = () => {
        console.log("🎨 Rendering send form:", { rate, bestRate, rateComparison, targetCurrency });
        return (
            <><div className="w-full h-2/3 flex flex-col gap-5 p-10 rounded-xl bg-white ">
                <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
                    <button
                        onClick={() => setActiveView("send")}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeView === "send" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
                    >
                        Rate Calculator
                    </button>
                    <button
                        onClick={() => setActiveView("rates")}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeView === "rates" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
                    >
                        Compare Rates
                    </button>
                </div>

                {bestRate && !isLoadingAllRates && targetCurrency && (
                    <div className="bg-blue-50 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                                <span className="font-semibold text-blue-800">Rate Insight</span>
                            </div>
                            <button
                                onClick={() => setActiveView("rates")}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                                View All →
                            </button>
                        </div>
                        <p className="text-blue-700 text-sm mt-2">
                            Best rate: <strong>{bestRate.provider}</strong> gives you {bestRate.amountReceived.toLocaleString()}{" "}
                            {targetCurrency}.
                            {rateComparison && rateComparison.savings > 0 && (
                                <span>
                                    You could save {rateComparison.savings.toFixed(2)} {targetCurrency} (
                                    {rateComparison.savingsPercent.toFixed(1)}%) vs worst rate.
                                </span>
                            )}
                        </p>
                    </div>
                )}

                <div
                    className={`border rounded-xl ${error ? "border-red-400" : "border-gray-300"} px-5 py-2 flex justify-between my-5`}
                >
                    <div className="flex-1">
                        <p className="capitalize text-black">you send: </p>
                        <FormattedCurrencyInput
                            value={baseValue}
                            onChange={handleBaseChange}
                            placeholder="0.00"
                            className={`text-lg text-black ${isLoadingRate || rateRequestInProgress.current ? "opacity-50" : ""} w-full border-0 outline-none`}
                            disabled={isLoadingRate || rateRequestInProgress.current} />
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => !isLoadingRate && !rateRequestInProgress.current && setShowSourceList(!showSourceList)}
                            className={`flex items-center justify-between rounded-md bg-white h-full min-w-[120px] px-3 ${isLoadingRate || rateRequestInProgress.current ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"}`}
                            disabled={isLoadingRate || rateRequestInProgress.current}
                            type="button"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{currencyMap[sourceCurrency]?.flag}</span>
                                <span className="font-medium">{sourceCurrency}</span>
                            </div>
                            <ChevronDown className="w-4 h-4 text-gray-500 ml-2" />
                        </button>
                        {showSourceList && (
                            <div className="absolute text-black right-0 mt-1 w-64 border border-gray-200 rounded-md bg-white shadow-lg z-20 max-h-48 overflow-y-auto">
                                {map(sourceCurrencies, (currency) => (
                                    <div
                                        key={currency}
                                        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleSourceCurrencyChange(currency)}
                                    >
                                        <span className="text-xl">{currencyMap[currency]?.flag}</span>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{currency}</span>
                                            <span className="text-xs text-gray-500">{currencyMap[currency]?.country}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="text-sm text-gray-500 flex items-center justify-between">
                    <div className="flex items-center">
                        {isLoadingRate || rateRequestInProgress.current ? (
                            <div className="flex items-center">
                                <Loader className="w-4 h-4 mr-2 animate-spin" />
                                <span>Fetching latest rate...</span>
                            </div>
                        ) : rate && targetCurrency ? (
                            <div className="flex items-center gap-4">
                                <p>
                                    Rate: 1 {sourceCurrency} = {rate.toFixed(4)} {targetCurrency}
                                </p>
                                {bestRate && Math.abs(bestRate.exchangeRate - rate) > 0.001 && (
                                    <p className="text-green-600 text-xs">
                                        Best available: {bestRate.exchangeRate.toFixed(4)} ({bestRate.provider})
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-blue-500 text-sm">
                                {targetCurrency ? "Select amount to see live exchange rates" : "Select recipient currency"}
                            </p>
                        )}
                    </div>
                    {isLoadingAllRates && (
                        <div className="flex items-center text-xs text-blue-600">
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            <span>Updating rates...</span>
                        </div>
                    )}
                </div>

                <div
                    className={`border rounded-xl ${error ? "border-red-400" : "border-gray-300"} px-5 py-2 flex justify-between my-5`}
                >
                    <div className="flex-1">
                        <p className="capitalize text-black">recipient gets: </p>
                        {isLoadingRate || rateRequestInProgress.current ? (
                            <div className="text-lg text-gray-400">0.00</div>
                        ) : (
                            <FormattedCurrencyInput
                                value={targetValue || (baseValue && rate ? (parseFloat(baseValue) * rate).toFixed(2) :
                                    baseValue && bestRate ? (parseFloat(baseValue) * bestRate.exchangeRate).toFixed(2) : "")}
                                onChange={handleTargetChange}
                                placeholder="0.00"
                                className="text-lg w-full text-black border-0 outline-none"
                                disabled={isLoadingRate || rateRequestInProgress.current || !targetCurrency} />
                        )}
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => !isLoadingRate && !rateRequestInProgress.current && setShowTargetList(!showTargetList)}
                            className={`flex items-center justify-between rounded-md bg-white h-full min-w-[120px] px-3 ${isLoadingRate || rateRequestInProgress.current ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"}`}
                            disabled={isLoadingRate || rateRequestInProgress.current}
                            type="button"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{currencyMap[targetCurrency]?.flag || "🌐"}</span>
                                <span className="font-medium text-black">{targetCurrency || "Select Currency"}</span>
                            </div>
                            <ChevronDown className="w-4 h-4 text-gray-500 ml-2" />
                        </button>
                        {showTargetList && (
                            <div className="absolute text-black right-0 mt-1 w-64 border border-gray-200 rounded-md bg-white shadow-lg z-20 max-h-48 overflow-y-auto">
                                {map(targetCurrencies, (currency) => (
                                    <div
                                        key={currency}
                                        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => handleTargetCurrencyChange(currency)}
                                    >
                                        <span className="text-xl">{currencyMap[currency]?.flag}</span>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{currency}</span>
                                            <span className="text-xs text-gray-500">{currencyMap[currency]?.country}</span>
                                        </div>
                                    </div>))}
                            </div>
                        )}
                    </div>
                </div>
            </div><div className="space-y-3">
                    {bestRate && rate && Math.abs(bestRate.exchangeRate - rate) > 0.001 && !isLoadingRate && targetCurrency && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertCircle className="w-4 h-4 text-yellow-600" />
                                <span className="font-medium text-yellow-800 text-sm">Better Rate Available</span>
                            </div>
                            <p className="text-yellow-700 text-xs">
                                <strong>{bestRate.provider}</strong> offers a better rate. You could get{" "}
                                {((parseFloat(baseValue) || 0) * bestRate.exchangeRate).toFixed(2)} {targetCurrency} instead of {targetValue}{" "}
                                {targetCurrency}.
                            </p>
                        </div>
                    )}
                    {/* <button
                    onClick={handleContinue}
                    className={`w-full ${isContinueDisabled ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"} text-white rounded-xl p-3 transition-colors`}
                    disabled={isContinueDisabled}
                    type="button"
                >
                    {isLoadingRate || rateRequestInProgress.current ? (
                        <div className="flex items-center justify-center">
                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                            Calculating...
                        </div>
                    ) : (
                        "Continue"
                    )}
                </button> */}
                </div>
            </>
        );
    };

    return (
        <div className="w-screen lg:w-full h-full flex justify-center items-center">
            <div className="w-full lg:w-3/5 h-full flex flex-col gap-10">
                <div className="flex items-center justify-between">
                    <div className="w-full flex flex-col justify-center items-center">
                        <h1 className="text-blue-600 text-6xl font-bold">Go global with PCX</h1>
                        <br />
                        <h3 className="text-gray-600 text-2xl text-center">Send money worldwide with ease, speed and security.</h3>
                    </div>
                </div>
                <div className="border border-gray-200 bg-white rounded-lg">
                    {activeView === "send" ? renderSendForm() : renderRatesComparison()}
                    {showSourceList && <div className="fixed inset-0 z-10" onClick={() => setShowSourceList(false)} />}
                    {showTargetList && <div className="fixed inset-0 z-10" onClick={() => setShowTargetList(false)} />}
                </div>
            </div>
        </div>
    );
}

export default Send;
