"use client";
import React from "react";
import { RefreshCw, Target, BarChart3, Settings, LogIn } from "lucide-react";

export default function Header({
  activeTab,
  setActiveTab,
  setShowSettings,
  showSettings,
  fetchRates,
  isLoading,
  ScrapeRates,
  isLoadingAllRates,
  fromCurrency,
  toCurrency,
  sendAmount,
  isCurrentCorridorCrypto,
  error,
  handleManualLogin,
  defaultOrg,
  isDefaultOrgValid,
}) {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10 p-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Multi-Source Rate Engine with Benchmarking</h1>
            <p className="text-sm text-gray-500">Compare your rates against providers</p>
            {isCurrentCorridorCrypto && (
              <div className="flex items-center gap-2 mt-2">
                <span className="whitespace-nowrap px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                  Crypto Mode
                </span>
                <span className="text-xs text-gray-500">
                  Using Coinbase API for {fromCurrency} → {toCurrency}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab("benchmark")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "benchmark" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              >
                <Target className="w-4 h-4 inline mr-1" />
                Benchmark
              </button>
              <button
                onClick={() => setActiveTab("comparison")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "comparison" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              >
                <BarChart3 className="w-4 h-4 inline mr-1" />
                Comparison
              </button>
              <button
                onClick={() => setActiveTab("simulator")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "simulator" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
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
                Fetch Rates (PCX provider's)
              </button>
              <button
                onClick={() => ScrapeRates(fromCurrency, toCurrency, parseFloat(sendAmount))}
                disabled={isLoadingAllRates}
                className={`flex whitespace-nowrap items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors ${isCurrentCorridorCrypto ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingAllRates ? "animate-spin" : ""}`} />
                {isCurrentCorridorCrypto ? "Scrape Crypto Rates" : "Scrape Rates"}
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
  );
}