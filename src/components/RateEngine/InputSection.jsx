"use client";
import React from "react";
import {
    Plus,
    Minus,
} from "lucide-react";

const getCurrencySymbol = (currencyCode) => {
  const symbols = {
    USD: '$',
    NGN: '₦',
    GHS: '₵',
    GBP: '£',
    EUR: '€',
    KES: 'Sh',
    ZAR: 'R',
    RWF: 'RF',
    BTC: '₿',
    ETH: 'Ξ',
    USDC: '$',
    BTC: '₿',
    ETH: 'Ξ',
    USDC: '$',
    USDT: '$',
    ADA: '₳',
    XRP: 'XRP',
    LTC: 'Ł',
    BCH: 'BCH',
    DOT: '●',
    LINK: 'LINK',
    BNB: 'BNB',
    SOL: 'SOL',
    MATIC: 'MATIC',
    AVAX: 'AVAX',
    UNI: 'UNI',
    DOGE: 'Ð'
  };
  return symbols[currencyCode] || currencyCode;
};

export default function InputSection({
  sendAmount,
  handleAmountChange,
  fromCurrency,
  formatCurrency,
  setFromCurrency,
  toCurrency,
  setToCurrency,
  selectedPCXOrg,
  setSelectedPCXOrg,
  isLoadingOrgs,
  fetchedOrgs,
  defaultOrg,
  isDefaultOrgValid,
  isCurrentCorridorCrypto,
  currentPCXRate,
  adjustedRate,
  getPositionForRate,
  benchmarkList,
  spreadAdjustment,
  setSpreadAdjustment,
  adjustSpread,
  isFiatCurrency,
  isCryptocurrency,
}) {
  console.log('fromCurrency:', fromCurrency);
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              {getCurrencySymbol(fromCurrency)}
            </span>
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
            <optgroup label="Fiat Currencies">
              <option value="USD-NGN">USD → NGN</option>
              <option value="NGN-USD">NGN → USD</option>
              <option value="USD-GHS">USD → GHS</option>
              <option value="USD-GBP">USD → GBP</option>
              <option value="GBP-NGN">GBP → NGN</option>
              <option value="GBP-GHS">GBP → GHS</option>
              <option value="NGN-GBP">NGN → GBP</option>
              <option value="KES-GBP">KES → GBP</option>
              <option value="GHS-NGN">GHS → NGN</option>
              <option value="ZAR-GBP">ZAR → GBP</option>
              <option value="GBP-ZAR">GBP → ZAR</option>
              <option value="RWF-GBP">RWF → GBP</option>
            </optgroup>
            <optgroup label="Crypto Currencies">
              <option value="USD-BTC">USD → BTC</option>
              <option value="USD-ETH">USD → ETH</option>
              <option value="USD-USDC">USD → USDC</option>
              <option value="NGN-USDC">NGN → USDC</option>
              <option value="GBP-BTC">GBP → BTC</option>
              <option value="EUR-ETH">EUR → ETH</option>
              <option value="BTC-USD">BTC → USD</option>
              <option value="ETH-USD">ETH → USD</option>
              <option value="USDC-NGN">USDC → NGN</option>
              <option value="BTC-ETH">BTC → ETH</option>
            </optgroup>
          </select>
          <div className="flex gap-1 text-xs">
            <span className={`px-2 py-0.5 rounded-full ${isCryptocurrency(fromCurrency) ? 'bg-orange-100 text-orange-700' : isFiatCurrency(fromCurrency) ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
              {fromCurrency} {isCryptocurrency(fromCurrency) ? '' : ''}
            </span>
            <span className="text-gray-400">→</span>
            <span className={`px-2 py-0.5 rounded-full ${isCryptocurrency(toCurrency) ? 'bg-orange-100 text-orange-700' : isFiatCurrency(toCurrency) ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
              {toCurrency} {isCryptocurrency(toCurrency) ? '' : ''}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700">
            PCX Organization Rate Selector
            {selectedPCXOrg === defaultOrg.name && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                Default
                {isDefaultOrgValid === false && <span className="ml-1 text-red-600"> (Not Found)</span>}
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
            <span>Base: {isCurrentCorridorCrypto ? currentPCXRate.baseRate.toFixed(8) : currentPCXRate.baseRate.toFixed(2)}</span>
            <span>Spread: {isCurrentCorridorCrypto ? currentPCXRate.spread.toFixed(8) : currentPCXRate.spread.toFixed(2)}</span>
            <span className="font-semibold">Final: {isCurrentCorridorCrypto ? adjustedRate.toFixed(8) : adjustedRate.toFixed(2)}</span>
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
            {isCurrentCorridorCrypto && (
              <div className="flex justify-between text-xs pt-1 border-t">
                <span className="text-orange-600">API:</span>
                <span className="font-semibold text-orange-600">Crypto</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Spread Adjustment:</label>
            <div className="flex items-center gap-2">
              <button onClick={() => adjustSpread(isCurrentCorridorCrypto ? -0.00000001 : -0.1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors">
                <Minus className="text-black w-4 h-4" />
              </button>
              <input
                type="number"
                value={isCurrentCorridorCrypto ? spreadAdjustment.toFixed(8) : spreadAdjustment.toFixed(2)}
                onChange={(e) => setSpreadAdjustment(parseFloat(e.target.value) || 0)}
                className="w-24 text-black px-2 py-1 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                step={isCurrentCorridorCrypto ? "0.00000001" : "0.1"}
              />
              <button onClick={() => adjustSpread(isCurrentCorridorCrypto ? 0.00000001 : 0.1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors">
                <Plus className="text-black w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSpreadAdjustment(isCurrentCorridorCrypto ? -0.00000005 : -0.5)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors">
              {isCurrentCorridorCrypto ? "-0.00000005" : "-0.5"}
            </button>
            <button onClick={() => setSpreadAdjustment(0)} className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors">
              Reset
            </button>
            <button onClick={() => setSpreadAdjustment(isCurrentCorridorCrypto ? 0.00000005 : 0.5)} className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors">
              {isCurrentCorridorCrypto ? "+0.00000005" : "+0.5"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}