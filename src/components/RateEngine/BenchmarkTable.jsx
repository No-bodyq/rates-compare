"use client";
import React from "react";
import { useState } from "react";

export default function BenchmarkTable({
  benchmarkList,
  selectedPCXOrg,
  adjustedRate,
  isCurrentCorridorCrypto,
  sendAmount,
  formatCurrency,
  toCurrency,
  fromCurrency,
  getPositionForRate,
  calculateRecipientAmount,
}) {
  console.log('benchmarkList', benchmarkList);
  console.log('formatCurrency', formatCurrency);
  console.log('toCurrency', toCurrency);
  console.log('getPositionForRate', getPositionForRate);
  console.log('sendAmount', sendAmount);
  console.log('fromCurrency', fromCurrency);
  console.log('calculateRecipientAmount', calculateRecipientAmount);
  
  const [spreadAdjustment, setSpreadAdjustment] = useState(0);
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Complete Rate Benchmark {fromCurrency} / {toCurrency}</h3>
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
              const isSelectedPCX = item.name === `PCX: ${selectedPCXOrg}`;
              const displayRate = isSelectedPCX ? adjustedRate : item.finalRate;
              
              // Use the universal currency calculator passed from parent
              const recipientAmount = calculateRecipientAmount(
                sendAmount, 
                displayRate, 
                fromCurrency, 
                toCurrency, 
                item.provider
              );
              
              return (
                <tr
                  key={`${item.type}-${item.name}`}
                  className={`${isSelectedPCX ? "bg-blue-50 ring-2 ring-blue-200" : "hover:bg-gray-50"} ${item.apiSource === 'crypto' ? "bg-orange-25" : item.type === "provider" ? "bg-green-25" : ""} transition-colors`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${index === 0 ? "bg-green-100 text-green-800" : index === 1 ? "bg-yellow-100 text-yellow-800" : index === 2 ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-800"}`}
                    >
                      #{index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      {isSelectedPCX && item.status === "active" && (
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
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded ${item.apiSource === 'crypto' ? "bg-orange-100 text-orange-800" : item.type === "provider" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}
                    >
                      {item.apiSource === 'crypto' ? "Crypto" : item.type === "provider" ? "Competitor" : "PCX"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {isCurrentCorridorCrypto ? item.baseRate.toFixed(8) : item.baseRate.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {/* {
                      <span className="text-sm font-semibold text-gray-900">{(spreadAdjustment)}</span>
                    } */}
                    {/* Spread adjustment column - currently empty but preserved for future use */}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {isCurrentCorridorCrypto ? displayRate.toFixed(8) : displayRate.toFixed(4)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">FREE</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(recipientAmount, toCurrency)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{item.lastUpdate}</td>
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
              {benchmarkList[0]?.name} ({isCurrentCorridorCrypto ? benchmarkList[0]?.finalRate.toFixed(8) : benchmarkList[0]?.finalRate.toFixed(4)})
            </span>
          </div>
          <div>
            <span className="text-gray-600">Your Position:</span>
            <span className="ml-2 font-semibold text-indigo-600">#{getPositionForRate(adjustedRate)} of {benchmarkList.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Spread to Beat #1:</span>
            <span className="ml-2 font-semibold text-gray-900">
              {isCurrentCorridorCrypto ? Math.max(0, benchmarkList[0]?.finalRate - adjustedRate).toFixed(8) : Math.max(0, benchmarkList[0]?.finalRate - adjustedRate).toFixed(4)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}