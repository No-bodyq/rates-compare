"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  RefreshCw,
  Target,
  BarChart3,
  Settings,
  Plus,
  Minus,
  AlertCircle,
  LogIn,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getPCXAuthToken, getOrganizations, getExchangeRates, getExchangeRatesByOrg, refreshPCXAuthToken } from "../services/auth-service";
import useAuthStore from "../stores/authStore";
import { toast, ToastContainer } from "react-toastify";

function RateEngine() {
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
      setFetchedRates(null); // Clear previous rates
      toast.info("Fetching rates from external providers...", { toastId: "scrape-rates" });

      try {
        console.log(`🔄 Scraping rates: ${base} → ${target} (${amount})`);
        const response = await fetch(
          `/api/scrape-rates?base=${base}&target=${target}&amount=${amount}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("📥 ScrapeRates response:", data);

        if (data.success && data.data.rates) {
          const mappedRates = data.data.rates.map((rate, index) => ({
            ...rate,
            from_currency: base,
            to_currency: target,
            exchangeRate: rate.recipientReceives
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
          }));

          const rateMap = new Map();
          mappedRates.forEach((rate) => {
            const provider = rate.provider;
            if (!rateMap.has(provider) || rate.amountReceived > rateMap.get(provider).amountReceived) {
              rateMap.set(provider, rate);
            } else {
              console.log(
                `🚫 Duplicate rate discarded for ${provider}: ${rate.amountReceived} (kept: ${rateMap.get(provider).amountReceived})`
              );
            }
          });

          const deduplicatedRates = Array.from(rateMap.values());
          console.log("✅ Deduplicated rates set:", deduplicatedRates);
          setFetchedRates({ data: deduplicatedRates });
          toast.success("Rates scraped successfully!", { toastId: "scrape-rates-success" });
        } else {
          throw new Error(data.error || "No valid rates data received");
        }
      } catch (error) {
        console.error("💥 Error scraping rates:", error);
        setError(error.message || "Failed to scrape rates. Please try again.");
        toast.error(error.message || "Failed to scrape rates.", { toastId: "scrape-rates-error" });
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
      matchingRates.sort((a, b) => parseFloat(b.rate || 0) - parseFloat(a.rate || 0));
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
      setFetchedRates(null); // Clear previous rates
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

  // Fetch data on mount and clear old data
  useEffect(() => {
    setFetchedRates(null); // Clear rates on mount
    setFetchedOrgRates({}); // Clear org rates on mount
    getPCXAuthToken();
    fetchOrgs();
    fetchAllRates();
    fetchOrgRates(defaultOrg.id, defaultOrg.name);
  }, [fetchOrgs, fetchAllRates, defaultOrg]);

  // Reset fetchedOrgRates when selectedPCXOrg changes
  useEffect(() => {
    setFetchedOrgRates({}); // Clear org rates when organization changes
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

  // Reset rates when currency corridor changes
  useEffect(() => {
    setFetchedRates(null); // Clear rates when corridor changes
    setFetchedOrgRates({}); // Clear org rates when corridor changes
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

  // Set default selectedPCXOrg
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
          rateList.push({
            name: provider,
            baseRate: parseFloat(bestRate.rate),
            spread: 0,
            finalRate: parseFloat(bestRate.rate),
            status: "active",
            type: "provider",
            fee: 0,
            lastUpdate: new Date(bestRate.updatedAt).toLocaleString(),
            reliability: 99.0,
            provider: provider,
            rateId: bestRate.rate_id,
            color: "#10B981",
          });
        }
      });
    }
    if (fetchedOrgs?.data?.organizations) {
      fetchedOrgs.data.organizations.forEach((org) => {
        const orgRates = fetchedOrgRates[org.org_id];
        let bestRate = orgRates
          ? orgRates.data.find(
              (rate) => rate.from_currency === fromCurrency && rate.to_currency === toCurrency
            )
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
          const baseRate = baseProviderRate ? parseFloat(baseProviderRate.rate) : 0.00046;
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
        });
      });
    }
    if (!fetchedOrgs?.data?.organizations || 
        !fetchedOrgs.data.organizations.find(org => org.org_name === defaultOrg.name || org.org_id === defaultOrg.id)) {
      const orgRates = fetchedOrgRates[defaultOrg.id];
      let bestRate = orgRates
        ? orgRates.data.find(
            (rate) => rate.from_currency === fromCurrency && rate.to_currency === toCurrency
          )
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
        const baseRate = baseProviderRate ? parseFloat(baseProviderRate.rate) : 0.00046;
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
      ? orgRates.data.find(
          (rate) => rate.from_currency === fromCurrency && rate.to_currency === toCurrency
        )
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
      const baseRate = baseProviderRate ? parseFloat(baseProviderRate.rate) : 0.00046;
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
  const recipientGetsYou = parseFloat(sendAmount || 0) * adjustedRate;
  const benchmarkList = enhancedRateData;

  const fetchRates = useCallback(() => {
    setIsLoading(true);
    setFetchedRates(null); // Clear rates before fetching
    fetchAllRates();
    setTimeout(() => setIsLoading(false), 1500);
  }, [fetchAllRates]);

  const formatNumber = useCallback((num) => {
    const numValue = parseFloat(num) || 0;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  }, []);

  const formatCurrency = useCallback((amount, currency = "USD") => {
    const numValue = parseFloat(amount) || 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  }, []);

  const getPositionForRate = useCallback(
    (rate) => {
      const sortedList = [...benchmarkList].sort((a, b) => b.finalRate - a.finalRate);
      return sortedList.findIndex((item) => Math.abs(item.finalRate - rate) < 0.00001) + 1;
    },
    [benchmarkList]
  );

  const handleAmountChange = useCallback((value) => {
    const cleanValue = value.replace(/[^0-9.]/g, "");
    if (cleanValue === "" || /^\d*\.?\d*$/.test(cleanValue)) {
      setSendAmount(cleanValue);
    }
  }, []);

  const adjustSpread = useCallback((delta) => {
    setSpreadAdjustment((prev) => Math.round((prev + delta) * 100000) / 100000);
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

  const hasFetchedRates = useMemo(() => {
    return fetchedRates?.data?.some(
      (rate) => rate.from_currency === fromCurrency && rate.to_currency === toCurrency
    );
  }, [fetchedRates, fromCurrency, toCurrency]);

  return (
    <div className="min-h-screen mt-10 bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 p-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Multi-Source Rate Engine with Benchmarking</h1>
              <p className="text-sm text-gray-500">Compare your rates against providers</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("benchmark")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === "benchmark"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Target className="w-4 h-4 inline mr-1" />
                  Benchmark
                </button>
                <button
                  onClick={() => setActiveTab("comparison")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === "comparison"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <BarChart3 className="w-4 h-4 inline mr-1" />
                  Comparison
                </button>
                <button
                  onClick={() => setActiveTab("simulator")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === "simulator"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Settings className="w-4 h-4 inline mr-1" />
                  Simulator
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Default Organization Settings"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={fetchRates}
                  disabled={isLoading}
                  className="flex whitespace-nowrap items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                  Fetch Rates
                </button>
                <button
                  onClick={() => {
                    setIsUserInteracted(true);
                    ScrapeRates(fromCurrency, toCurrency, parseFloat(sendAmount));
                  }}
                  disabled={isLoadingAllRates}
                  className="flex whitespace-nowrap items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingAllRates ? "animate-spin" : ""}`} />
                  Scrape Rates
                </button>
                {error.includes("Authentication required") && (
                  <button
                    onClick={handleManualLogin}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <LogIn className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                    Log In
                  </button>
                )}
              </div>
            </div>
          </div>
          {isDefaultOrgValid === false && (
            <div className="text-xs text-red-600">
              Warning: Default organization "{defaultOrg.name}" (ID: {defaultOrg.id.slice(0, 8)}...) not found in available organizations.
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {showSettings && (
          <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Default Organization Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Organization Name
                </label>
                <input
                  type="text"
                  value={defaultOrg.name}
                  onChange={(e) => setDefaultOrg((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full text-black px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter organization name"
                />
                <p className="mt-1 text-xs text-gray-500">
                  The name of the organization to select by default
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Organization ID
                </label>
                <input
                  type="text"
                  value={defaultOrg.id}
                  onChange={(e) => setDefaultOrg((prev) => ({ ...prev, id: e.target.value }))}
                  className="w-full text-black px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter organization ID"
                />
                <p className="mt-1 text-xs text-gray-500">
                  The unique ID of the organization (UUID format)
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setDefaultOrg({
                      name: "pcx-retail",
                      id: "96b7cd64-d0db-4dcc-97d1-5ecd1af14f9a",
                    });
                    toast.success("Reset to original default organization.", {
                      toastId: "default-org-reset",
                    });
                  }}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Reset to Default
                </button>
                {fetchedOrgs?.data?.organizations && (
                  <select
                    value=""
                    onChange={(e) => {
                      const selectedOrg = fetchedOrgs.data.organizations.find(
                        (org) => org.org_id === e.target.value
                      );
                      if (selectedOrg) {
                        setDefaultOrg({
                          name: selectedOrg.org_name,
                          id: selectedOrg.org_id,
                        });
                        setIsDefaultOrgValid(true);
                        toast.success(`Default organization set to ${selectedOrg.org_name}.`, {
                          toastId: "default-org-updated",
                        });
                      }
                    }}
                    className="text-black px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select from existing organizations...</option>
                    {fetchedOrgs.data.organizations.map((org) => (
                      <option key={org.org_id} value={org.org_id}>
                        {org.org_name} ({org.org_id.slice(0, 8)}...)
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-600">
                  Current Status:
                  {isDefaultOrgValid === null ? (
                    <span className="ml-1 text-gray-600 font-medium">Checking...</span>
                  ) : isDefaultOrgValid ? (
                    <span className="ml-1 text-green-600 font-medium">✓ Found</span>
                  ) : (
                    <span className="ml-1 text-red-600 font-medium">✗ Not Found</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedPCXOrg(defaultOrg.name);
                    setFetchedOrgRates({}); // Clear org rates
                    fetchOrgRates(defaultOrg.id, defaultOrg.name);
                    toast.info(`Applied default organization "${defaultOrg.name}".`, {
                      toastId: "default-org-applied",
                    });
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Apply Default
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  value={sendAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full text-black pl-8 pr-3 py-2 text-sm font-semibold border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Corridor</label>
              <select
                value={`${fromCurrency}-${toCurrency}`}
                onChange={(e) => {
                  const [from, to] = e.target.value.split("-");
                  setFromCurrency(from);
                  setToCurrency(to);
                }}
                className="w-full text-black px-3 py-2 text-sm font-medium border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                <option value="USD-NGN">USD → NGN</option>
                <option value="USD-GHS">USD → GHS</option>
                <option value="USD-GBP">USD → GBP</option>
                <option value="GBP-NGN">GBP → NGN</option>
                <option value="NGN-GBP">NGN → GBP</option>
                <option value="KES-GBP">KES → GBP</option>
                <option value="GHS-NGN">GHS → NGN</option>
                <option value="ZAR-GBP">ZAR → GBP</option>
                <option value="RWF-GBP">RWF → GBP</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">
                PCX Rate Selector
                {selectedPCXOrg === defaultOrg.name && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                    Default
                    {isDefaultOrgValid === false && (
                      <span className="ml-1 text-red-600"> (Not Found)</span>
                    )}
                  </span>
                )}
              </label>
              <select
                value={selectedPCXOrg}
                onChange={(e) => setSelectedPCXOrg(e.target.value)}
                className="w-full text-black px-3 py-2 text-sm font-medium border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              >
                {isLoadingOrgs ? (
                  <option>Loading organizations...</option>
                ) : !fetchedOrgs?.data?.organizations || fetchedOrgs.data.organizations.length === 0 ? (
                  <option value={defaultOrg.name}>
                    {defaultOrg.name} (Default{isDefaultOrgValid === false ? ", Not Found" : ""})
                  </option>
                ) : (
                  [
                    ...fetchedOrgs.data.organizations.map((org) => (
                      <option key={org.org_id} value={org.org_name}>
                        {org.org_name}
                        {org.org_name === defaultOrg.name && ` (Default${isDefaultOrgValid === false ? ", Not Found" : ""})`}
                      </option>
                    )),
                    !fetchedOrgs.data.organizations.some((org) => org.org_name === defaultOrg.name || org.org_id === defaultOrg.id) && (
                      <option key={defaultOrg.id} value={defaultOrg.name}>
                        {defaultOrg.name} (Default, Not Found)
                      </option>
                    ),
                  ].filter(Boolean)
                )}
              </select>
              <div className="flex justify-between text-xs text-gray-600 pt-1">
                <span>
                  Base: {(fromCurrency === "NGN" && toCurrency === "GBP") ? currentPCXRate.baseRate.toFixed(5) : currentPCXRate.baseRate.toFixed(2)}
                </span>
                <span>
                  Spread: {(fromCurrency === "NGN" && toCurrency === "GBP") ? currentPCXRate.spread.toFixed(5) : currentPCXRate.spread.toFixed(2)}
                </span>
                <span className="font-semibold">
                  Final: {(fromCurrency === "NGN" && toCurrency === "GBP") ? adjustedRate.toFixed(5) : adjustedRate.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">Quick Stats</label>
              <div className="bg-gray-50 rounded-md p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Position:</span>
                  <span className="font-semibold text-gray-900">#{getPositionForRate(adjustedRate)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Margin:</span>
                  <span className="font-semibold text-green-600">
                    {currentPCXRate.baseRate ? ((currentPCXRate.spread + spreadAdjustment) / currentPCXRate.baseRate * 100).toFixed(2) : "0.00"}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Better than:</span>
                  <span className="font-semibold text-gray-900">
                    {benchmarkList.filter((item) => adjustedRate > item.finalRate).length}/{benchmarkList.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Spread Adjustment:</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustSpread((fromCurrency === "NGN" && toCurrency === "GBP") ? -0.00001 : -0.1)}
                    className="p-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  >
                    <Minus className="text-black w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={(fromCurrency === "NGN" && toCurrency === "GBP") ? spreadAdjustment.toFixed(5) : spreadAdjustment.toFixed(2)}
                    onChange={(e) => setSpreadAdjustment(parseFloat(e.target.value) || 0)}
                    className="w-24 text-black px-2 py-1 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                    step={(fromCurrency === "NGN" && toCurrency === "GBP") ? "0.00001" : "0.1"}
                  />
                  <button
                    onClick={() => adjustSpread((fromCurrency === "NGN" && toCurrency === "GBP") ? 0.00001 : 0.1)}
                    className="p-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  >
                    <Plus className="text-black w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSpreadAdjustment((fromCurrency === "NGN" && toCurrency === "GBP") ? -0.00005 : -0.5)}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors"
                >
                  {(fromCurrency === "NGN" && toCurrency === "GBP") ? "-0.00005" : "-0.5"}
                </button>
                <button
                  onClick={() => setSpreadAdjustment(0)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => setSpreadAdjustment((fromCurrency === "NGN" && toCurrency === "GBP") ? 0.00005 : 0.5)}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors"
                >
                  {(fromCurrency === "NGN" && toCurrency === "GBP") ? "+0.00005" : "+0.5"}
                </button>
              </div>
            </div>
          </div>
        </div>
        {fetchedRates?.data && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Live Provider Rates for {fromCurrency} → {toCurrency}
              </h3>
              <span className="text-xs text-gray-500">
                {getProvidersForCorridor(fetchedRates, fromCurrency, toCurrency).length} providers available
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {getProvidersForCorridor(fetchedRates, fromCurrency, toCurrency).map((provider) => {
                const bestRate = findBestRate(fetchedRates, fromCurrency, toCurrency, parseFloat(sendAmount), provider);
                return bestRate ? (
                  <div key={provider} className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-xs font-medium text-green-800 capitalize">{provider}</div>
                    <div className="text-lg font-bold text-green-900">
                      {(fromCurrency === "NGN" && toCurrency === "GBP") ? parseFloat(bestRate.rate).toFixed(5) : parseFloat(bestRate.rate).toFixed(2)}
                    </div>
                    <div className="text-xs text-green-700">
                      Updated: {new Date(bestRate.updatedAt).toLocaleTimeString()}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
            {getProvidersForCorridor(fetchedRates, fromCurrency, toCurrency).length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No rates available for {fromCurrency} → {toCurrency} corridor click scrape to fetch from different provider's
              </div>
            )}
          </div>
        )}
        {activeTab === "benchmark" && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Complete Rate Benchmark</h3>
              <p className="text-xs text-gray-500 mt-1">Sorted by best rate for customers (highest to lowest)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Base Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Spread</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Final Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Transfer Fee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Recipient Gets</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Last Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {benchmarkList.map((item, index) => {
                    const isActive = item.name === `PCX: ${selectedPCXOrg}`;
                    const displayRate = isActive ? adjustedRate : item.finalRate;
                    const recipientAmount = parseFloat(sendAmount || 0) * displayRate;
                    return (
                      <tr
                        key={`${item.type}-${item.name}`}
                        className={`${
                          isActive ? "bg-blue-50 ring-2 ring-blue-200" : "hover:bg-gray-50"
                        } ${item.type === "provider" ? "bg-green-25" : ""} transition-colors`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              index === 0
                                ? "bg-green-100 text-green-800"
                                : index === 1
                                ? "bg-yellow-100 text-yellow-800"
                                : index === 2
                                ? "bg-orange-100 text-orange-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            #{index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                            {isActive && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-indigo-600 text-white rounded">
                                Active
                              </span>
                            )}
                            
                            {item.type === "pcx" && item.status === "inactive" && (
                              <span className="px-1 py-0.5 text-xs font-medium bg-yellow-600 text-white rounded">
                                INACTIVE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                              item.type === "provider"
                                ? "bg-green-100 text-green-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {item.type === "provider" ? "Live Provider" : "PCX"}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {(fromCurrency === "NGN" && toCurrency === "GBP") ? item.baseRate.toFixed(5) : item.baseRate.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {(fromCurrency === "NGN" && toCurrency === "GBP") ? item.spread.toFixed(5) : item.spread.toFixed(2)}
                          {isActive && spreadAdjustment !== 0 && (
                            <span
                              className={`ml-1 text-xs ${
                                spreadAdjustment > 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {spreadAdjustment > 0 ? "+" : ""}
                              {(fromCurrency === "NGN" && toCurrency === "GBP")
                                ? spreadAdjustment.toFixed(5)
                                : spreadAdjustment.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-semibold text-gray-900">
                            {(fromCurrency === "NGN" && toCurrency === "GBP") ? displayRate.toFixed(5) : displayRate.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                            FREE
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {toCurrency} {formatNumber(recipientAmount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                          {item.lastUpdate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between items-center text-sm">
                <div>
                  <span className="text-gray-600">Best Rate:</span>
                  <span className="ml-2 font-semibold text-gray-900">
                    {benchmarkList[0]?.name} (
                    {(fromCurrency === "NGN" && toCurrency === "GBP")
                      ? benchmarkList[0]?.finalRate.toFixed(5)
                      : benchmarkList[0]?.finalRate.toFixed(2)}
                    )
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Your Position:</span>
                  <span className="ml-2 font-semibold text-indigo-600">
                    #{getPositionForRate(adjustedRate)} of {benchmarkList.length}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Spread to Beat #1:</span>
                  <span className="ml-2 font-semibold text-gray-900">
                    {(fromCurrency === "NGN" && toCurrency === "GBP")
                      ? Math.max(0, benchmarkList[0]?.finalRate - adjustedRate).toFixed(5)
                      : Math.max(0, benchmarkList[0]?.finalRate - adjustedRate).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === "comparison" && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                Rate Comparison Chart - {fromCurrency} → {toCurrency}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Visual comparison of all rates for {sendAmount} {fromCurrency}
              </p>
              {isLoadingAllRates && (
                <div className="text-xs text-blue-600 mt-1">Loading live provider rates...</div>
              )}
            </div>
            <div className="p-6">
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={11} />
                    <YAxis
                      domain={[
                        (fromCurrency === "NGN" && toCurrency === "GBP") ? "dataMin - 0.00005" : "dataMin - 5",
                        (fromCurrency === "NGN" && toCurrency === "GBP") ? "dataMax + 0.00005" : "dataMax + 5",
                      ]}
                      tickFormatter={(value) =>
                        (fromCurrency === "NGN" && toCurrency === "GBP") ? value.toFixed(5) : value.toFixed(2)
                      }
                    />
                    <Tooltip
                      formatter={(value) =>
                        (fromCurrency === "NGN" && toCurrency === "GBP") ? value.toFixed(5) : value.toFixed(2)
                      }
                      labelFormatter={(label) => `Provider: ${label}`}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border rounded shadow-lg">
                              <p className="font-medium">{label}</p>
                              <p className="text-sm">
                                <span className="text-blue-600">Rate:</span>{" "}
                                {(fromCurrency === "NGN" && toCurrency === "GBP")
                                  ? payload[0].value.toFixed(5)
                                  : payload[0].value.toFixed(2)}
                              </p>
                              <p className="text-sm">
                                <span className="text-green-600">Type:</span> {data.type}
                              </p>
                              <p className="text-sm">
                                <span className="text-gray-600">You get:</span> {toCurrency}{" "}
                                {formatNumber(parseFloat(sendAmount) * payload[0].value)}
                              </p>
                              <p className="text-xs text-gray-500">
                                Last updated: {data.lastUpdate}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Bar dataKey="displayRate" fill="#8884d8" name="Exchange Rate">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-xs text-gray-600">Live Providers</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-500 rounded"></div>
                  <span className="text-xs text-gray-600">PCX Organizations</span>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-xs font-medium text-green-800">Live Providers</div>
                  <div className="text-lg font-bold text-green-900">
                    {chartData.filter((item) => item.type === "provider").length}
                  </div>
                  <div className="text-xs text-green-700">Real-time rates</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-xs font-medium text-blue-800">Best Rate</div>
                  <div className="text-lg font-bold text-blue-900">
                    {(fromCurrency === "NGN" && toCurrency === "GBP")
                      ? chartData[0]?.finalRate.toFixed(5)
                      : chartData[0]?.finalRate.toFixed(2)}
                  </div>
                  <div className="text-xs text-blue-700">{chartData[0]?.name}</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="text-xs font-medium text-yellow-800">Avg Rate</div>
                  <div className="text-lg font-bold text-yellow-900">
                    {(fromCurrency === "NGN" && toCurrency === "GBP")
                      ? (chartData.reduce((sum, item) => sum + item.finalRate, 0) / chartData.length).toFixed(5)
                      : (chartData.reduce((sum, item) => sum + item.finalRate, 0) / chartData.length).toFixed(2)}
                  </div>
                  <div className="text-xs text-yellow-700">All providers</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs font-medium text-gray-800">Rate Spread</div>
                  <div className="text-lg font-bold text-gray-900">
                    {(fromCurrency === "NGN" && toCurrency === "GBP")
                      ? (
                          Math.max(...chartData.map((item) => item.finalRate)) -
                          Math.min(...chartData.map((item) => item.finalRate))
                        ).toFixed(5)
                      : (
                          Math.max(...chartData.map((item) => item.finalRate)) -
                          Math.min(...chartData.map((item) => item.finalRate))
                        ).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-700">High - Low</div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === "simulator" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Spread Impact Simulator</h3>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Simulate Different Spreads</h4>
                  <div className="space-y-3 text-black">
                    {[(fromCurrency === "NGN" && toCurrency === "GBP") ? -0.00005 : -1.0, (fromCurrency === "NGN" && toCurrency === "GBP") ? -0.00002 : -0.5, 0.0, (fromCurrency === "NGN" && toCurrency === "GBP") ? 0.00002 : 0.5, (fromCurrency === "NGN" && toCurrency === "GBP") ? 0.00005 : 1.0].map((spread) => {
                      const simulatedRate = currentPCXRate.finalRate + spread;
                      const position = getPositionForRate(simulatedRate);
                      const betterThan = benchmarkList.filter((item) => simulatedRate > item.finalRate).length;
                      const isCurrentSpread =
                        Math.abs(spread - spreadAdjustment) < (fromCurrency === "NGN" && toCurrency === "GBP" ? 0.00001 : 0.01);
                      return (
                        <div
                          key={spread}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isCurrentSpread ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">
                              Spread: {spread > 0 ? "+" : ""}
                              {(fromCurrency === "NGN" && toCurrency === "GBP") ? spread.toFixed(5) : spread.toFixed(2)}
                            </span>
                            <span className="text-sm text-gray-600">
                              Rate: {(fromCurrency === "NGN" && toCurrency === "GBP") ? simulatedRate.toFixed(5) : simulatedRate.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                position <= 3
                                  ? "bg-green-100 text-green-800"
                                  : position <= 6
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              #{position}
                            </span>
                            <span className="text-xs text-gray-600 min-w-[80px]">
                              Beats {betterThan}/{benchmarkList.length}
                            </span>
                            <button
                              onClick={() => setSpreadAdjustment(spread)}
                              className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Impact Analysis</h4>
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-xs text-gray-600">Current Rate</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {(fromCurrency === "NGN" && toCurrency === "GBP") ? adjustedRate.toFixed(5) : adjustedRate.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-600">Position</div>
                        <div className="text-2xl font-bold text-indigo-600">#{getPositionForRate(adjustedRate)}</div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Margin %</span>
                        <span className="font-semibold text-green-600">
                          {currentPCXRate.baseRate
                            ? ((currentPCXRate.spread + spreadAdjustment) / currentPCXRate.baseRate * 100).toFixed(2)
                            : "0.00"}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600">Profit/Tx</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(
                            parseFloat(sendAmount || 0) * (currentPCXRate.spread + spreadAdjustment) / 100
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h5 className="text-sm font-medium text-gray-700">Optimization Targets</h5>
                    <div className="space-y-3">
                      {(() => {
                        const wiseRate = benchmarkList.find((c) => c.name === "wise")?.finalRate || 0;
                        const spreadToBeatWise =
                          wiseRate - currentPCXRate.finalRate + (fromCurrency === "NGN" && toCurrency === "GBP" ? 0.00001 : 0.01);
                        return (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">
                              To beat Wise (
                              {(fromCurrency === "NGN" && toCurrency === "GBP") ? wiseRate.toFixed(5) : wiseRate.toFixed(2)}
                              ):
                            </span>
                            <span className="font-medium text-blue-600">
                              Need {spreadToBeatWise > 0 ? "+" : ""}
                              {(fromCurrency === "NGN" && toCurrency === "GBP")
                                ? spreadToBeatWise.toFixed(5)
                                : spreadToBeatWise.toFixed(2)}{" "}
                              spread
                            </span>
                          </div>
                        );
                      })()}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">To be #1:</span>
                        <span className="font-medium text-blue-600">
                          Need rate ≥{" "}
                          {(fromCurrency === "NGN" && toCurrency === "GBP")
                            ? benchmarkList[0]?.finalRate.toFixed(5)
                            : benchmarkList[0]?.finalRate.toFixed(2)}
                        </span>
                      </div>
                      {(() => {
                        const safeRate = benchmarkList[4]?.finalRate || (fromCurrency === "NGN" && toCurrency === "GBP" ? 0.00046 : 0);
                        const safePosition = Math.min(5, benchmarkList.length);
                        return (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Safe profitable position:</span>
                            <span className="font-medium text-blue-600">
                              {(fromCurrency === "NGN" && toCurrency === "GBP") ? safeRate.toFixed(5) : safeRate.toFixed(2)} (beats{" "}
                              {benchmarkList.filter((item) => safeRate > item.finalRate).length}/{safePosition})
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <ToastContainer />
    </div>
  );
}

export default RateEngine;