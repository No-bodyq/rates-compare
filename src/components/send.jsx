"use client";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ChevronDown, Loader, AlertCircle, ArrowUpDown, TrendingUp, Clock, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { map } from "lodash";
import useAuthStore from "../stores/authStore";
import { getPCXAuthToken, getExchangeRates, getProviderExchangeRates } from "../services/auth-service";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Helper function to get country flag emoji
const getCountryFlag = (countryCode) => {
  if (!countryCode) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
};

// Currency to country mapping
const currencyCountryMap = {
  USD: { countryCode: "US", country: "United States" },
  EUR: { countryCode: "EU", country: "European Union" },
  GBP: { countryCode: "GB", country: "United Kingdom" },
  KES: { countryCode: "KE", country: "Kenya" },
  NGN: { countryCode: "NG", country: "Nigeria" },
  GHS: { countryCode: "GH", country: "Ghana" },
  RWF: {countryCode: "RWA", country: "Rwanda"},
  INR: { countryCode: "IN", country: "India" },
  TZS: { countryCode: "TZ", country: "Tanzania" },
  UGX: { countryCode: "UG", country: "Uganda" },
  XAF: { countryCode: "CM", country: "Cameroon" },
  XOF: { countryCode: "CI", country: "Côte d'Ivoire" },
  ZAR: { countryCode: "ZA", country: "South Africa" },
};

// Provider logos mapping
const PROVIDER_LOGOS = {
  sendwave: "/sendwavelogo.png",
  nala: "/nalalogo.png",
  remitly: "/remi-logo.png",
  taptapsend: "/taptapsend-logo.png",
  fastforex: "/fastforex-logo.png",
  westernunion: "/western.png",
  abokifx: "/abokiFx.png",
  wise: "/wise.png",
  flutterwave: "/flutterwave.jpg",
  ngnrates: "/ngnrates.png",
};

// Hardcoded providers list
const HARDCODED_PROVIDERS = [
  "flutterwave",
  "Remitly",
  "Western Union",
  "Wise",
  "NALA",
  "ngnrates",
  "abokifx",
];

// Helper function to get provider logo
const getProviderLogo = (providerName) => {
  if (!providerName) return null;
  const normalizedName = providerName.toLowerCase().replace(/\s+/g, "");
  if (PROVIDER_LOGOS[normalizedName]) {
    return PROVIDER_LOGOS[normalizedName];
  }
  for (const [key, logo] of Object.entries(PROVIDER_LOGOS)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return logo;
    }
  }
  return null;
};

const availableCurrencies = Object.keys(currencyCountryMap);

// FormattedCurrencyInput component
const FormattedCurrencyInput = ({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  readOnly = false,
}) => {
  const formatNumberWithCommas = (num) => {
    if (!num || num === "") return "";
    const number = parseFloat(num);
    if (isNaN(number)) return "";
    return number.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleInputChange = (e) => {
    const inputValue = e.target.value;
    const numericValue = inputValue.replace(/[^\d.]/g, "");
    const parts = numericValue.split(".");
    if (parts.length > 2) return;
    onChange(numericValue);
  };

  if (readOnly) {
    return <div className={className}>{formatNumberWithCommas(value)}</div>;
  }

  const displayValue = value || "";

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleInputChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      onBlur={(e) => {
        if (e.target.value && !isNaN(parseFloat(e.target.value))) {
          const formatted = parseFloat(e.target.value).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          e.target.value = formatted;
        }
      }}
      onFocus={(e) => {
        const numericValue = e.target.value.replace(/[^\d.]/g, "");
        e.target.value = numericValue;
      }}
    />
  );
};

// Debounce helper function
const debounce = (func, wait) => {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
};

// Helpers for finding rates
const findBestRate = (rates, fromCurrency, toCurrency, amount, selectedProvider) => {
  if (!rates?.data) return null;

  const validRates = rates.data
    .filter(
      (rate) =>
        rate.active &&
        rate.from_currency === fromCurrency &&
        rate.to_currency === toCurrency &&
        !isNaN(parseFloat(rate.rate)) &&
        new Date(rate.effective_to) > new Date()
    )
    .map((rate) => ({
      ...rate,
      amountReceived: parseFloat(amount) * parseFloat(rate.rate),
      provider: rate.provider,
      rate: parseFloat(rate.rate),
    }));

  if (validRates.length === 0) return null;

  if (selectedProvider) {
    const providerRate = validRates.find(
      (rate) => rate.provider.toLowerCase() === selectedProvider.toLowerCase()
    );
    if (providerRate) return providerRate;
  }

  const flutterwaveRate = validRates.find((rate) => rate.provider.toLowerCase() === "flutterwave");
  if (flutterwaveRate) return flutterwaveRate;

  return validRates.reduce((best, current) =>
    current.amountReceived > best.amountReceived ? current : best
  );
};

const getBestRate = (rates) => {
  const successRates = rates.filter(
    (rate) => rate.status === "success" && !isNaN(rate.amountReceived)
  );
  if (successRates.length === 0) return null;

  return successRates.reduce((best, current) =>
    current.amountReceived > best.amountReceived ? current : best
  );
};

const getRateComparison = (rates) => {
  const successRates = rates.filter(
    (rate) => rate.status === "success" && !isNaN(rate.amountReceived)
  );
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
  const token = useAuthStore((state) => state.token);
  const fetchNewToken = useAuthStore((state) => state.fetchNewToken);
  const isTokenValid = useAuthStore((state) => state.isTokenValid);
  const initTokenRefresh = useAuthStore((state) => state.initTokenRefresh);
  const [activeView, setActiveView] = useState("send");
  const [rate, setRate] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState("flutterwave");
  const [showProviderList, setShowProviderList] = useState(false);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [baseValue, setBaseValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [sourceCurrency, setSourceCurrency] = useState("USD");
  const [targetCurrency, setTargetCurrency] = useState("");
  const [showSourceList, setShowSourceList] = useState(false);
  const [showTargetList, setShowTargetList] = useState(false);
  const [error, setError] = useState("Please select both source and recipient currencies");
  const [amountError, setAmountError] = useState("");
  const [allRates, setAllRates] = useState([]);
  const [isLoadingAllRates, setIsLoadingAllRates] = useState(false);
  const [bestRate, setBestRate] = useState(null);
  const [rateComparison, setRateComparison] = useState(null);
  const [lastRateUpdate, setLastRateUpdate] = useState(null);
  const [lastEditedField, setLastEditedField] = useState(null);
  const [isUserInteracted, setIsUserInteracted] = useState(false);
  const [fetchedRates, setFetchedRates] = useState(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [providerError, setProviderError] = useState("");
  const [providerRates, setProviderRates] = useState(null);
  const [isLoadingProviderRates, setIsLoadingProviderRates] = useState(false);
  const sourceCurrencyRef = useRef(sourceCurrency);
  const targetCurrencyRef = useRef(targetCurrency);
  const rateRequestInProgress = useRef(false);
  const currentRequestRef = useRef(null);
  const debouncedFetchRef = useRef(null);
  const baseValueRef = useRef(baseValue);
  const sourceDropdownRef = useRef(null);
  const targetDropdownRef = useRef(null);

  const useClickOutside = (ref, callback) => {
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (ref.current && !ref.current.contains(event.target)) {
          callback();
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref, callback]);
  };

  useClickOutside(sourceDropdownRef, () => setShowSourceList(false));
  useClickOutside(targetDropdownRef, () => setShowTargetList(false));

  useEffect(() => {
    sourceCurrencyRef.current = sourceCurrency;
    targetCurrencyRef.current = targetCurrency;
  }, [sourceCurrency, targetCurrency]);

  useEffect(() => {
    if (initTokenRefresh) {
      const cleanup = initTokenRefresh();
      return cleanup;
    }
  }, [initTokenRefresh]);

  useEffect(() => {
    if (!token && !isLoadingRate) {
      fetchNewToken();
    }
  }, [token, fetchNewToken, isLoadingRate]);

  useEffect(() => {
    if (availableCurrencies.length === 0) {
      setError("No currencies available. Please check currency configuration.");
    }
  }, []);

  useEffect(() => {
    if (!fetchedRates?.data && !isLoadingRate) {
      setError("Failed to load currency data. Please try again.");
    }
  }, [fetchedRates, isLoadingRate]);

  const fetchPCXRates = useCallback(async () => {
    try {
      setIsLoadingRate(true);
      setIsLoadingAllRates(true);
      setError("");
      
      const { token, isTokenValid } = useAuthStore.getState();
      
      if (token && isTokenValid()) {
        console.log("✅ Using cached token");
      } else {
        console.log("⚠️ No valid cached token, will authenticate...");
      }
      
      const ratesData = await getExchangeRates();
      
      if (!ratesData || !ratesData.data) {
        setError("No exchange rate data received from API");
        return;
      }
      
      setFetchedRates(ratesData);
      setRefetchTrigger((prev) => prev + 1);
      
      if (sourceCurrency && targetCurrency && baseValue) {
        const amount = parseFloat(baseValue) || 1000;
        const bestRateData = findBestRate(ratesData, sourceCurrency, targetCurrency, amount, selectedProvider);
        if (bestRateData) {
          setRate(bestRateData.rate);
          if (lastEditedField === "base") {
            const convertedAmount = (parseFloat(baseValue) * bestRateData.rate).toFixed(2);
            setTargetValue(convertedAmount);
          }
        }
      }
      
      toast.success("Exchange rates fetched successfully!", {
        toastId: "fetch-rates-success",
      });
      
    } catch (error) {
      console.error("❌ Error fetching rates:", error);
      setError(error.message || "Failed to fetch rates from PCX API");
      setFetchedRates(null);
    } finally {
      setIsLoadingRate(false);
      setIsLoadingAllRates(false);
    }
  }, [sourceCurrency, targetCurrency, baseValue, selectedProvider, lastEditedField]);

  const availableProviders = useMemo(() => {
    if (!fetchedRates?.data || !sourceCurrency || !targetCurrency) return [];
    return [
      ...new Set(
        fetchedRates.data
          .filter(
            (rate) =>
              rate.active &&
              rate.from_currency === sourceCurrency &&
              rate.to_currency === targetCurrency &&
              !isNaN(parseFloat(rate.rate)) &&
              new Date(rate.effective_to) > new Date()
          )
          .map((rate) => rate.provider)
      ),
    ];
  }, [fetchedRates, sourceCurrency, targetCurrency]);

  const isFlutterwaveSupported = useMemo(() => {
    return availableProviders.includes("flutterwave");
  }, [availableProviders]);

  const fetchExchangeRate = useCallback(
    async (from, to, amount) => {
      if (!from || !to) {
        setError("Please select both source and recipient currencies");
        setIsLoadingRate(false);
        rateRequestInProgress.current = false;
        return;
      }
      if (!amount) {
        setAmountError("Please enter an amount");
        setIsLoadingRate(false);
        rateRequestInProgress.current = false;
        return;
      }
      if (!isUserInteracted) {
        setIsLoadingRate(false);
        return;
      }

      if (from === to) {
        setIsLoadingRate(false);
        setRate(1);
        setProviderError("");
        setAmountError("");
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
      setProviderError("");
      setAmountError("");

      const requestId = Date.now();
      currentRequestRef.current = requestId;

      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timed out")), 10000)
        );

        let ratesToUse = fetchedRates;

        if (selectedProvider) {
          try {
            setIsLoadingProviderRates(true);
            const authResult = await Promise.race([getPCXAuthToken(), timeoutPromise]);
            const providerRatesData = await Promise.race([getProviderExchangeRates(authResult.token, selectedProvider), timeoutPromise]);
            setProviderRates(providerRatesData);
            ratesToUse = providerRatesData;
          } catch (providerError) {
            if (providerError.message.includes("not found") || providerError.message.includes("no available rates")) {
              setProviderError(
                `${selectedProvider} does not support ${from} to ${to} exchange. Please select a different provider or currency pair.`
              );
              if (availableProviders.length > 0 && selectedProvider.toLowerCase() === "flutterwave") {
                const fallbackProvider =
                  availableProviders.find((p) => p.toLowerCase() !== "flutterwave") || availableProviders[0];
                setSelectedProvider(fallbackProvider);
                ratesToUse = fetchedRates;
              }
            } else {
              setProviderError(`Failed to fetch rates from ${selectedProvider}. ${providerError.message}`);
              ratesToUse = fetchedRates;
            }
          } finally {
            setIsLoadingProviderRates(false);
          }
        }

        if (!ratesToUse?.data) {
          setError("No rates available. Please try again.");
          return;
        }

        const bestRateData = findBestRate(ratesToUse, from, to, amount, selectedProvider);
        if (bestRateData) {
          setRate(bestRateData.rate);
          setError("");
          setAmountError("");
          if (lastEditedField === "base") {
            const convertedAmount = (parseFloat(amount) * bestRateData.rate).toFixed(2);
            setTargetValue(convertedAmount);
          } else if (lastEditedField === "target") {
            const calculatedBase = parseFloat(targetValue) / bestRateData.rate;
            const formattedBase = isNaN(calculatedBase) ? "" : calculatedBase.toFixed(2);
            setBaseValue(formattedBase);
            baseValueRef.current = formattedBase;
          }
        } else {
          setError(`No valid rate found for ${from} to ${to}. Try a different provider.`);
        }
      } catch (error) {
        if (requestId === currentRequestRef.current) {
          setRate(null);
          if (!providerError) {
            setError(error.message || "Failed to fetch rate. Please try again.");
          }
        }
      } finally {
        if (requestId === currentRequestRef.current) {
          setIsLoadingRate(false);
          rateRequestInProgress.current = false;
        }
      }
    },
    [
      lastEditedField,
      targetValue,
      isUserInteracted,
      fetchedRates,
      selectedProvider,
      availableProviders,
      providerError,
    ]
  );

  const fetchAllRates = useCallback(
    async (base, target, amount) => {
      if (!base || !target) {
        setError("Please select both source and recipient currencies");
        setIsLoadingAllRates(false);
        return;
      }
      if (!amount) {
        setAmountError("Please enter an amount");
        setIsLoadingAllRates(false);
        return;
      }
      if (!isUserInteracted) {
        setIsLoadingAllRates(false);
        return;
      }

      setIsLoadingAllRates(true);

      try {
        if (!fetchedRates?.data) {
          setError("No rates available from PCX API");
          return;
        }

        const mappedRates = fetchedRates.data
          .filter(
            (rate) =>
              rate.active &&
              rate.from_currency === base &&
              rate.to_currency === target &&
              !isNaN(parseFloat(rate.rate)) &&
              new Date(rate.effective_to) > new Date()
          )
          .map((rate, index) => ({
            provider: rate.provider,
            exchangeRate: parseFloat(rate.rate),
            amountReceived: parseFloat(amount) * parseFloat(rate.rate),
            rateTime: new Date(rate.updatedAt).toLocaleTimeString(),
            status: "success",
            uniqueId: `${rate.provider}-${index}-${rate.updatedAt}`,
            fees: 0,
          }));

        const rateMap = new Map();
        mappedRates.forEach((rate) => {
          const provider = rate.provider;
          if (!rateMap.has(provider) || rate.amountReceived > rateMap.get(provider).amountReceived) {
            rateMap.set(provider, rate);
          }
        });

        const deduplicatedRates = Array.from(rateMap.values());
        setAllRates(deduplicatedRates);
        setError("");
        setAmountError("");

        const best = getBestRate(deduplicatedRates);
        setBestRate(best);

        const comparison = getRateComparison(deduplicatedRates);
        setRateComparison(comparison);

        setLastRateUpdate(new Date());
      } catch (error) {
        setAllRates([]);
        setBestRate(null);
        setRateComparison(null);
        setError(error.message || "Failed to fetch rates. Please try again.");
      } finally {
        setIsLoadingAllRates(false);
      }
    },
    [isUserInteracted, fetchedRates]
  );

  useEffect(() => {
    debouncedFetchRef.current = debounce((from, to, amount) => {
      fetchExchangeRate(from, to, amount);
    }, 1000);
  }, [fetchExchangeRate]);

  useEffect(() => {
    if (
      sourceCurrency &&
      targetCurrency &&
      sourceCurrency !== targetCurrency &&
      isUserInteracted &&
      baseValue
    ) {
      const amount = parseFloat(baseValue) || 0;
      fetchAllRates(sourceCurrency, targetCurrency, amount);
    } else if (!sourceCurrency || !targetCurrency) {
      setError("Please select both source and recipient currencies");
    } else if (!baseValue) {
      setAmountError("Please enter an amount");
    }
  }, [sourceCurrency, targetCurrency, baseValue, isUserInteracted, fetchAllRates, refetchTrigger]);

  useEffect(() => {
    baseValueRef.current = baseValue;
  }, [baseValue]);

  const handleSourceCurrencyChange = (currency) => {
    setShowSourceList(false);
    setIsLoadingRate(true);
    setRate(null);
    setTargetValue("");
    setSourceCurrency(currency);
    sourceCurrencyRef.current = currency;
    setIsUserInteracted(true);
    setError(targetCurrency ? "" : "Please select a recipient currency");
    setProviderError("");
    setProviderRates(null);

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
      const amount = parseFloat(baseValue) || 0;
      fetchAllRates(currency, targetCurrency, amount);
    } else {
      setAmountError("Please enter an amount");
      setIsLoadingRate(false);
    }
  };

  const handleTargetCurrencyChange = (currency) => {
    setShowTargetList(false);
    setIsLoadingRate(true);
    setRate(null);
    setTargetValue("");
    setTargetCurrency(currency);
    targetCurrencyRef.current = currency;
    setIsUserInteracted(true);
    setError(sourceCurrency ? "" : "Please select a source currency");
    setProviderError("");
    setProviderRates(null);

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
      const amount = parseFloat(baseValue) || 0;
      fetchAllRates(sourceCurrency, currency, amount);
    } else {
      setAmountError("Please enter an amount");
      setIsLoadingRate(false);
    }
  };

  const handleProviderChange = (provider) => {
    setSelectedProvider(provider);
    setShowProviderList(false);
    setProviderError("");
    setProviderRates(null);
    if (sourceCurrency && targetCurrency && baseValue) {
      fetchExchangeRate(sourceCurrency, targetCurrency, baseValue);
    }
  };

  const handleCurrencySwap = () => {
    if (!sourceCurrency || !targetCurrency) {
      setError("Please select both source and recipient currencies");
      return;
    }

    if (sourceCurrency === targetCurrency) {
      setError("Cannot swap the same currency");
      return;
    }

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
    setError("");
    setAmountError(tempTargetValue ? "" : "Please enter an amount");
    setProviderError("");
    setProviderRates(null);

    if (tempTarget !== tempSource && tempTargetValue) {
      fetchExchangeRate(tempTarget, tempSource, tempTargetValue);
      const amount = parseFloat(tempTargetValue) || 0;
      fetchAllRates(tempTarget, tempSource, amount);
    }
  };

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
      if (!baseValue) {
        setAmountError("Please enter an amount");
      }
      return;
    }
    debouncedFetchRef.current(sourceCurrency, targetCurrency, baseValue);
  }, [sourceCurrency, targetCurrency, baseValue, isUserInteracted]);

  useEffect(() => {
    if (rate !== null && error) {
      setError("");
    }
    if (rate !== null && amountError) {
      setAmountError("");
    }
  }, [rate, error, amountError]);

  const handleBaseChange = (newValue) => {
    setLastEditedField("base");
    setBaseValue(newValue);
    baseValueRef.current = newValue;
    setIsUserInteracted(true);

    if (!newValue) {
      setAmountError("Please enter an amount");
      setTargetValue("");
      return;
    } else {
      setAmountError("");
    }

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
  };

  const handleTargetChange = (newValue) => {
    setLastEditedField("target");
    setTargetValue(newValue);
    setIsUserInteracted(true);

    if (!newValue) {
      setAmountError("Please enter an amount");
      setBaseValue("");
      baseValueRef.current = "";
      return;
    } else {
      setAmountError("");
    }

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

  const isSwapAllowed = sourceCurrency && targetCurrency && sourceCurrency !== targetCurrency;

  const renderRatesComparison = () => {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-blue-600 p-6">
            <div className="flex bg-white/20 rounded-2xl p-1 mb-6">
              <button
                onClick={() => setActiveView("send")}
                className={`flex-1 py-3 px-6 rounded-xl text-sm font-medium ${
                  activeView === "send"
                    ? "bg-white text-blue-600 shadow-lg transform scale-105"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" />
                  Rate Calculator
                </span>
              </button>
              <button
                onClick={() => setActiveView("rates")}
                className={`flex-1 py-3 px-6 rounded-xl text-sm font-medium ${
                  activeView === "rates"
                    ? "bg-white text-blue-600 shadow-lg transform scale-105"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Compare Rates
                </span>
              </button>
            </div>
            <div className="text-white">
              <h2 className="text-2xl font-bold mb-2">Live Exchange Rates</h2>
              <p className="text-white/80 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {lastRateUpdate
                  ? `Last updated: ${lastRateUpdate.toLocaleTimeString()}`
                  : "Fetching latest rates..."}
              </p>
            </div>
          </div>
          {(providerError || error || amountError) && (
            <div className="mx-6 mt-6 bg-red-50 border border-red-200 rounded-2xl p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-red-800 mb-1">
                    {providerError ? "Provider Error" : amountError ? "Amount Error" : "Error"}
                  </h4>
                  <p className="text-sm text-red-700">{providerError || amountError || error}</p>
                </div>
              </div>
            </div>
          )}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-8">
              <div className="relative">
                <p className="text-sm font-medium text-gray-600 mb-3">When selling</p>
                <div
                  className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-4 cursor-pointer hover:shadow-md border border-gray-200"
                  onClick={() => setShowSourceList(true)}
                >
                  <span className="text-3xl">{getCountryFlag(currencyCountryMap[sourceCurrency]?.countryCode)}</span>
                  <div className="flex-1">
                    <span className="font-bold text-lg text-gray-800">
                      {baseValue || "0"} {sourceCurrency || "Select"}
                    </span>
                    <p className="text-xs text-gray-500">{currencyCountryMap[sourceCurrency]?.country}</p>
                  </div>
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </div>
                {showSourceList && (
                  <div className="absolute left-0 mt-2 w-full border border-gray-200 rounded-2xl bg-white shadow-xl z-50 max-h-60 overflow-y-auto">
                    {map(availableCurrencies, (currency) => (
                      <div
                        key={currency}
                        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                        onClick={() => handleSourceCurrencyChange(currency)}
                      >
                        <span className="text-2xl">{getCountryFlag(currencyCountryMap[currency]?.countryCode)}</span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-800">{currency}</span>
                          <span className="text-xs text-gray-500">
                            {currencyCountryMap[currency]?.country}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center">
                <button
                  onClick={handleCurrencySwap}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isSwapAllowed
                      ? "bg-blue-600 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:scale-110"
                      : "bg-gray-200 cursor-not-allowed opacity-50"
                  }`}
                  title={
                    isSwapAllowed
                      ? "Swap currencies"
                      : sourceCurrency && targetCurrency
                      ? "Cannot swap the same currency"
                      : "Select both currencies to swap"
                  }
                  disabled={!isSwapAllowed}
                >
                  <ArrowUpDown className="w-5 h-5" />
                </button>
              </div>
              <div className="relative text-black">
                <p className="text-sm font-medium text-gray-600 mb-3">Choose currency</p>
                <div
                  className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-4 cursor-pointer hover:shadow-md border border-gray-200"
                  onClick={() => setShowTargetList(true)}
                >
                  <span className="text-3xl">
                    {targetCurrency ? getCountryFlag(currencyCountryMap[targetCurrency]?.countryCode) : "🌐"}
                  </span>
                  <div className="flex-1">
                    <span className="font-bold text-lg text-gray-800">
                      {targetCurrency || "Select Currency"}
                    </span>
                    {targetCurrency && (
                      <p className="text-xs text-gray-500">{currencyCountryMap[targetCurrency]?.country}</p>
                    )}
                  </div>
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </div>
                {showTargetList && (
                  <div className="absolute right-0 mt-2 w-full border border-gray-200 rounded-2xl bg-white shadow-xl z-50 max-h-60 overflow-y-auto">
                    {map(availableCurrencies, (currency) => (
                      <div
                        key={currency}
                        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                        onClick={() => handleTargetCurrencyChange(currency)}
                      >
                        <span className="text-2xl">{getCountryFlag(currencyCountryMap[currency]?.countryCode)}</span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-800">{currency}</span>
                          <span className="text-xs text-gray-500">
                            {currencyCountryMap[currency]?.country}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-10">Available Providers</h3>
              </div>
              <div className="relative text-black">
                <button
                  onClick={() => setShowProviderList(!showProviderList)}
                  disabled={!sourceCurrency || !targetCurrency || isLoadingAllRates}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 to-purple-600 text-white rounded-sm hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all duration-200 shadow-lg"
                >
                  <span className="font-medium">{selectedProvider || "Flutterwave"}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showProviderList && (
                  <div className="absolute right-0 mt-2 w-48 border border-gray-200 rounded-2xl bg-white shadow-xl z-50 max-h-48 overflow-y-auto">
                    {HARDCODED_PROVIDERS.map((provider) => (
                      <div
                        key={provider}
                        className="p-3 cursor-pointer hover:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl font-medium"
                        onClick={() => handleProviderChange(provider)}
                      >
                        {provider}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3 max-h-150 overflow-y-auto">
              {isLoadingAllRates ? (
                <div className="flex items-center justify-center py-12 text-blue-600">
                  <Loader className="w-8 h-8 animate-spin mr-3" />
                  <div className="text-center">
                    <p className="font-medium">Fetching rates...</p>
                    <p className="text-sm text-gray-500">This may take up to 30 seconds</p>
                  </div>
                </div>
              ) : allRates.length > 0 ? (
                allRates.map((rateData, index) => {
                  if (rateData.status !== "success" || isNaN(rateData.amountReceived)) {
                    return null;
                  }
                  const providerLogo = getProviderLogo(rateData.provider);
                  const isBest = bestRate && rateData.amountReceived === bestRate.amountReceived;
                  return (
                    <div
                      key={rateData.uniqueId || `${rateData.provider}-${index}`}
                      className={`flex justify-between items-center p-4 rounded-xl border-2 ${
                        isBest
                          ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-lg transform scale-[1.02]"
                          : "bg-gray-50 border-gray-200 hover:bg-gray-100 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {providerLogo ? (
                          <div className="w-12 h-12 relative flex-shrink-0">
                            <Image
                              src={providerLogo}
                              alt={`${rateData.provider} logo`}
                              width={48}
                              height={48}
                              className="object-contain rounded-xl"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl items-center justify-center text-white text-xl font-bold hidden">
                              {rateData.provider.charAt(0)}
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                            {rateData.provider.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-800 text-lg">{rateData.provider}</p>
                            {isBest && (
                              <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                                BEST
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {rateData.rateTime}
                            </span>
                            {rateData.fees > 0 && (
                              <span className="text-orange-600 font-medium">
                                Fees: {rateData.fees.toFixed(2)} {sourceCurrency}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-800">
                          {rateData.amountReceived.toLocaleString()} {targetCurrency}
                        </p>
                        <p className="text-sm text-gray-500">
                          Rate: {rateData.exchangeRate.toFixed(4)}
                        </p>
                        {rateComparison && (
                          <p className="text-xs text-gray-400">
                            {rateData.amountReceived === rateComparison.best.amountReceived
                              ? "Best rate"
                              : `${(((rateComparison.best.amountReceived - rateData.amountReceived) / rateComparison.best.amountReceived) * 100).toFixed(1)}% less`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center py-12 text-gray-500 bg-gray-50 rounded-2xl">
                  <AlertCircle className="w-8 h-8 mr-3" />
                  <div className="text-center">
                    <p className="font-medium">No rates available</p>
                    <p className="text-sm">Please select currencies and an amount, then try again.</p>
                  </div>
                </div>
              )}
              {allRates
                .filter((rate) => rate.status === "error")
                .map((errorRate, index) => {
                  const providerLogo = getProviderLogo(errorRate.provider);
                  return (
                    <div
                      key={`error-${errorRate.provider}-${index}`}
                      className="flex justify-between items-center p-4 bg-red-50 rounded-2xl border-2 border-red-200"
                    >
                      <div className="flex items-center gap-4">
                        {providerLogo ? (
                          <div className="w-12 h-12 relative opacity-50">
                            <Image
                              src={providerLogo}
                              alt={`${errorRate.provider} logo`}
                              width={48}
                              height={48}
                              className="object-contain rounded-xl grayscale"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                            <div className="w-12 h-12 bg-red-500 rounded-xl items-center justify-center text-white text-2xl font-bold hidden">
                              ❌
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                            ❌
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-red-800 text-lg">{errorRate.provider}</p>
                          <p className="text-sm text-red-600">{errorRate.error}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-red-600">Unavailable</p>
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="mt-8">
              <button
                onClick={() => setActiveView("send")}
                className="w-full bg-blue-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl p-4 font-semibold text-lg shadow-lg hover:shadow-xl"
              >
                Back to Calculator
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSendForm = () => {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border overflow-hidden">
          <div className="bg-blue-600 to-purple-600 p-6">
            <div className="flex bg-white/20 rounded-2xl p-1 mb-6">
              <button
                onClick={() => setActiveView("send")}
                className={`flex-1 py-3 px-6 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeView === "send"
                    ? "bg-white text-blue-600 shadow-lg transform scale-105"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" />
                  Rate Calculator
                </span>
              </button>
              <button
                onClick={() => setActiveView("rates")}
                className={`flex-1 py-3 px-6 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeView === "rates"
                    ? "bg-white text-blue-600 shadow-lg transform scale-105"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Compare Rates
                </span>
              </button>
            </div>
            <div className="text-white">
              <h2 className="text-2xl font-bold mb-2">Exchange Rate Calculator</h2>
              <p className="text-white/80">Get the best rates for your money transfers</p>
            </div>
          </div>
          {(providerError || error || amountError) && (
            <div className="mx-6 mt-6 bg-red-50 border border-red-200 rounded-2xl p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-red-800 mb-1">
                    {providerError ? "Provider Error" : amountError ? "Amount Error" : "Error"}
                  </h4>
                  <p className="text-sm text-red-700">{providerError || amountError || error}</p>
                </div>
              </div>
            </div>
          )}
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">1</span>
                You Sell
              </h3>
              <div className={`border-2 rounded-xl ${
                error || amountError ? "border-red-400" : "border-gray-200"
              } p-6 bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition-all duration-200`}>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <FormattedCurrencyInput
                      value={baseValue}
                      onChange={handleBaseChange}
                      placeholder="Enter amount"
                      className={`text-xl font-semibold outline-none text-gray-800 h-[30px] ${
                        isLoadingRate || rateRequestInProgress.current ? "opacity-50" : ""
                      } w-full bg-transparent border-0 outline-none placeholder-gray-400`}
                      disabled={isLoadingRate || rateRequestInProgress.current}
                    />
                  </div>
                  <div className="relative" ref={sourceDropdownRef}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isLoadingRate || rateRequestInProgress.current) {
                          toast.error("Cannot change currency while fetching rates", {
                            toastId: "currency-disabled",
                          });
                        } else {
                          setShowSourceList(!showSourceList);
                        }
                      }}
                      className={`flex items-center gap-3 rounded-xl bg-white min-w-[140px] px-5 py-2 shadow-md border border-gray-200 ${
                        isLoadingRate || rateRequestInProgress.current
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200"
                      }`}
                      disabled={isLoadingRate || rateRequestInProgress.current}
                      type="button"
                    >
                      <span className="text-2xl">{getCountryFlag(currencyCountryMap[sourceCurrency]?.countryCode) || "🌐"}</span>
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-gray-800">{sourceCurrency || "Select"}</span>
                        <span className="text-xs text-gray-500">{currencyCountryMap[sourceCurrency]?.country || "Currency"}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </button>
                    {showSourceList && (
                      availableCurrencies.length === 0 ? (
                        <div className="absolute right-0 mt-2 w-72 border border-gray-200 rounded-2xl bg-white shadow-xl z-50 p-4 text-center">
                          <Loader className="w-6 h-6 animate-spin mx-auto" />
                          <p className="text-sm text-gray-500">Loading currencies...</p>
                        </div>
                      ) : (
                        <div className="absolute right-0 mt-2 w-72 border border-gray-200 rounded-2xl bg-white shadow-xl z-50 h-72 overflow-auto">
                          {map(availableCurrencies, (currency) => (
                            <div
                              key={currency}
                              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                              onClick={() => handleSourceCurrencyChange(currency)}
                            >
                              <span className="text-2xl">{getCountryFlag(currencyCountryMap[currency]?.countryCode)}</span>
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-800">{currency}</span>
                                <span className="text-xs text-gray-500">
                                  {currencyCountryMap[currency]?.country}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleCurrencySwap}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isSwapAllowed
                    ? "bg-blue-600 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:scale-110"
                    : "bg-gray-200 cursor-not-allowed opacity-50"
                }`}
                title={
                  isSwapAllowed
                    ? "Swap currencies"
                    : sourceCurrency && targetCurrency
                    ? "Cannot swap the same currency"
                    : "Select both currencies to swap"
                }
                disabled={!isSwapAllowed}
              >
                <ArrowUpDown className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-sm">2</span>
                You Receive
              </h3>
              <div className={`border-2 rounded-xl ${
                error || amountError ? "border-red-400" : "border-gray-200"
              } p-6 to-white hover:shadow-md transition-all duration-200`}>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    {isLoadingRate || rateRequestInProgress.current ? (
                      <div className="flex items-center text-2xl font-bold text-gray-400">
                        <Loader className="w-6 h-6 animate-spin mr-2" />
                        Calculating...
                      </div>
                    ) : (
                      <FormattedCurrencyInput
                        value={
                          targetValue ||
                          (baseValue && rate
                            ? (parseFloat(baseValue) * rate).toFixed(2)
                            : "")
                        }
                        onChange={handleTargetChange}
                        placeholder="Amount you'll receive"
                        className="text-xl font-semibold text-gray-800 w-full border-0 outline-none placeholder-gray-400"
                        disabled={
                          isLoadingRate || rateRequestInProgress.current || !targetCurrency
                        }
                        readOnly={false}
                      />
                    )}
                  </div>
                  <div className="relative" ref={targetDropdownRef}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isLoadingRate || rateRequestInProgress.current) {
                          toast.error("Cannot change currency while fetching rates", {
                            toastId: "currency-disabled",
                          });
                        } else {
                          setShowTargetList(!showTargetList);
                        }
                      }}
                      className={`flex items-center gap-3 rounded-2xl bg-white min-w-[140px] px-6 py-2 shadow-md border border-gray-200 ${
                        isLoadingRate || rateRequestInProgress.current
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer hover:shadow-lg hover:border-green-300 transition-all duration-200"
                      }`}
                      disabled={isLoadingRate || rateRequestInProgress.current}
                      type="button"
                    >
                      <span className="text-2xl">
                        {targetCurrency ? getCountryFlag(currencyCountryMap[targetCurrency]?.countryCode) : "🌐"}
                      </span>
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-gray-800">
                          {targetCurrency || "Select"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {targetCurrency ? currencyCountryMap[targetCurrency]?.country : "Currency"}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </button>
                    {showTargetList && (
                      availableCurrencies.length === 0 ? (
                        <div className="absolute right-0 mt-2 w-72 border border-gray-200 rounded-2xl bg-white shadow-xl z-50 p-4 text-center">
                          <Loader className="w-6 h-6 animate-spin mx-auto" />
                          <p className="text-sm text-gray-500">Loading currencies...</p>
                        </div>
                      ) : (
                        <div className="absolute right-0 mt-2 w-72 border border-gray-200 rounded-2xl bg-white shadow-xl z-50 max-h-60 overflow-y-auto">
                          {map(availableCurrencies, (currency) => (
                            <div
                              key={currency}
                              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                              onClick={() => handleTargetCurrencyChange(currency)}
                            >
                              <span className="text-2xl">
                                {getCountryFlag(currencyCountryMap[currency]?.countryCode)}
                              </span>
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-800">{currency}</span>
                                <span className="text-xs text-gray-500">
                                  {currencyCountryMap[currency]?.country}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {isLoadingRate || rateRequestInProgress.current ? (
                    <div className="flex items-center text-blue-600">
                      <Loader className="w-6 h-6 mr-3 animate-spin" />
                      <div>
                        <p className="font-semibold">Fetching latest rate...</p>
                        <p className="text-sm text-blue-500">Getting you the best deal</p>
                      </div>
                    </div>
                  ) : rate && targetCurrency ? (
                    <div className="flex items-center gap-4">
                      {getProviderLogo(selectedProvider || "flutterwave") ? (
                        <div className="w-12 h-12 relative">
                          <Image
                            src={getProviderLogo(selectedProvider || "flutterwave")}
                            alt={`${selectedProvider || "Flutterwave"} logo`}
                            width={48}
                            height={48}
                            className="object-contain rounded-xl"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                          {(selectedProvider || "Flutterwave").charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="text-lg font-bold text-gray-800">
                          1 {sourceCurrency} = {rate.toFixed(4)} {targetCurrency}
                        </p>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <span>via {selectedProvider || "Flutterwave"} (PCX API)</span>
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          <span className="text-green-600 font-medium">Live</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-blue-600">
                      <p className="font-semibold">
                        {targetCurrency
                          ? "Select amount to see live exchange rates"
                          : "Select recipient currency"}
                      </p>
                      <p className="text-sm text-blue-500">Real-time rates from multiple providers</p>
                    </div>
                  )}
                </div>
                <div className="relative text-black">
                  <button
                    onClick={() => setShowProviderList(!showProviderList)}
                    disabled={!sourceCurrency || !targetCurrency || isLoadingRate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 shadow-lg font-medium"
                  >
                    <span>{selectedProvider || "Flutterwave"}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showProviderList && (
                    <div className="absolute right-0 mt-2 w-48 border border-gray-200 rounded-2xl bg-white shadow-xl z-50 max-h-48 overflow-y-auto">
                      {HARDCODED_PROVIDERS.map((provider) => (
                        <div
                          key={provider}
                          className="p-3 cursor-pointer hover:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl font-medium"
                          onClick={() => handleProviderChange(provider)}
                        >
                          {provider}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4 text-black">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">3</span>
                  Available Rates from different Providers
                </h3>
              </div>
              {isLoadingAllRates ? (
                <div className="flex items-center justify-center py-8 bg-gray-50 rounded-2xl">
                  <Loader className="w-6 h-6 animate-spin mr-3 text-blue-600" />
                  <div className="text-center">
                    <p className="font-medium text-gray-800">Fetching rates...</p>
                    <p className="text-sm text-gray-500">Comparing providers for you</p>
                  </div>
                </div>
              ) : allRates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-1 gap-3 max-h-72">
                  {allRates.map((rateData, index) => {
                    if (rateData.status !== "success" || isNaN(rateData.amountReceived)) {
                      return null;
                    }
                    const providerLogo = getProviderLogo(rateData.provider);
                    const isSelected =
                      selectedProvider === rateData.provider ||
                      (!selectedProvider && rateData.provider.toLowerCase() === "flutterwave");
                    const isBest = bestRate && rateData.amountReceived === bestRate.amountReceived;
                    return (
                      <div
                        key={rateData.uniqueId || `${rateData.provider}-${index}`}
                        className={`p-4 rounded-xl cursor-pointer border-2 ${
                          isSelected
                            ? "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 shadow-lg"
                            : isBest
                            ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:shadow-md"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100 hover:shadow-md"
                        }`}
                        onClick={() => handleProviderChange(rateData.provider)}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          {providerLogo ? (
                            <div className="w-8 h-8 relative">
                              <Image
                                src={providerLogo}
                                alt={`${rateData.provider} logo`}
                                width={32}
                                height={32}
                                className="object-contain rounded-lg"
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                              {rateData.provider.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-800 truncate">{rateData.provider}</p>
                              {isBest && (
                                <span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                                  BEST
                                </span>
                              )}
                              {isSelected && (
                                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                                  SELECTED
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-lg font-bold text-gray-800">
                            {rateData.amountReceived.toLocaleString()} {targetCurrency}
                          </p>
                          <div className="flex justify-between text-sm text-gray-500">
                            <span>Rate: {rateData.exchangeRate.toFixed(4)}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {rateData.rateTime}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 bg-gray-50 rounded-2xl">
                  <AlertCircle className="w-6 h-6 mr-3 text-gray-400" />
                  <div className="text-center">
                    <p className="font-medium text-gray-600">No rates available for this currency pair</p>
                    <p className="text-sm text-gray-500">Click "Fetch from API" to get rates</p>
                  </div>
                </div>
              )}
            </div>
            <div className="pt-6">
              <button
                onClick={fetchPCXRates}
                disabled={
                  isLoadingRate ||
                  rateRequestInProgress.current ||
                  !baseValue ||
                  parseFloat(baseValue) <= 0 ||
                  !sourceCurrency ||
                  !targetCurrency ||
                  error !== "" ||
                  amountError !== ""
                }
                className="w-full bg-blue-600 hover:from-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl p-4 font-semibold text-lg shadow-lg hover:shadow-xl disabled:transform-none disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isLoadingRate || rateRequestInProgress.current ? (
                  <>
                    <Loader className="w-6 h-6 animate-spin" />
                    Fetching Rates...
                  </>
                ) : (
                  <>
                    <Zap className="w-6 h-6" />
                    Fetch from  API
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="text-center mb-12 max-w-4xl">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
          <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-bold">
            Powered by
          </h1>
          <Image
            src="/PCXLogo.png"
            width={320}
            height={80}
            className="w-48 sm:w-64 lg:w-80 h-auto"
            alt="PCX Logo"
            priority
          />
        </div>
        <p className="text-white/90 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
          Send money worldwide with ease, speed, and security. Compare rates from multiple providers in real-time.
        </p>
      </div>
      <div className="w-full">
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          className="mt-20"
          toastClassName="!bg-white !text-gray-800 !border !border-gray-200 !shadow-xl !rounded-2xl"
          bodyClassName="!text-sm !font-medium"
          progressClassName="!bg-gradient-to-r !from-blue-500 !to-purple-500"
        />
        {activeView === "send" ? renderSendForm() : renderRatesComparison()}
      </div>
    </div>
  );
}

export default Send;