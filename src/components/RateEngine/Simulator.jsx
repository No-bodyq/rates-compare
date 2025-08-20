"use client";
import React from "react";

export default function Simulator({
  isCurrentCorridorCrypto,
  currentPCXRate,
  spreadAdjustment,
  setSpreadAdjustment,
  getPositionForRate,
  benchmarkList,
  adjustedRate,
  sendAmount,
  formatCurrency,
  fromCurrency,
  toCurrency,
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Spread Impact Simulator</h3>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-4">Simulate Different Spreads</h4>
            <div className="space-y-3 text-black">
              {[
                isCurrentCorridorCrypto ? -0.00000005 : -1.0,
                isCurrentCorridorCrypto ? -0.00000002 : -0.5,
                0.0,
                isCurrentCorridorCrypto ? 0.00000002 : 0.5,
                isCurrentCorridorCrypto ? 0.00000005 : 1.0,
              ].map((spread) => {
                const simulatedRate = currentPCXRate.finalRate + spread;
                const position = getPositionForRate(simulatedRate);
                const betterThan = benchmarkList.filter((item) => simulatedRate > item.finalRate).length;
                const isCurrentSpread = Math.abs(spread - spreadAdjustment) < (isCurrentCorridorCrypto ? 0.00000001 : 0.01);
                return (
                  <div
                    key={spread}
                    className={`flex items-center justify-between p-3 rounded-lg border ${isCurrentSpread ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        Spread: {spread > 0 ? "+" : ""}{isCurrentCorridorCrypto ? spread.toFixed(8) : spread.toFixed(2)}
                      </span>
                      <span className="text-sm text-gray-600">
                        Rate: {isCurrentCorridorCrypto ? simulatedRate.toFixed(8) : simulatedRate.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${position <= 3 ? "bg-green-100 text-green-800" : position <= 6 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}
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
                    {isCurrentCorridorCrypto ? adjustedRate.toFixed(8) : adjustedRate.toFixed(2)}
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
                    {currentPCXRate.baseRate ? ((currentPCXRate.spread + spreadAdjustment) / currentPCXRate.baseRate * 100).toFixed(2) : "0.00"}%
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">Profit/Tx</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(parseFloat(sendAmount || 0) * (currentPCXRate.spread + spreadAdjustment) / 100, fromCurrency)}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h5 className="text-sm font-medium text-gray-700">Optimization Targets</h5>
              <div className="space-y-3">
                {(() => {
                  const wiseRate = benchmarkList.find((c) => c.name === "wise")?.finalRate || 0;
                  const spreadToBeatWise = wiseRate - currentPCXRate.finalRate + (fromCurrency === "NGN" && toCurrency === "GBP" ? 0.00001 : 0.01);
                  return (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">
                        To beat Wise ({(fromCurrency === "NGN" && toCurrency === "GBP") ? wiseRate.toFixed(5) : wiseRate.toFixed(2)}):
                      </span>
                      <span className="font-medium text-blue-600">
                        Need {spreadToBeatWise > 0 ? "+" : ""}{(fromCurrency === "NGN" && toCurrency === "GBP") ? spreadToBeatWise.toFixed(5) : spreadToBeatWise.toFixed(2)} spread
                      </span>
                    </div>
                  );
                })()}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">To be #1:</span>
                  <span className="font-medium text-blue-600">
                    Need rate ≥ {(fromCurrency === "NGN" && toCurrency === "GBP") ? benchmarkList[0]?.finalRate.toFixed(5) : benchmarkList[0]?.finalRate.toFixed(2)}
                  </span>
                </div>
                {(() => {
                  const safeRate = benchmarkList[4]?.finalRate || (fromCurrency === "NGN" && toCurrency === "GBP" ? 0.00046 : 0);
                  const safePosition = Math.min(5, benchmarkList.length);
                  return (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Safe profitable position:</span>
                      <span className="font-medium text-blue-600">
                        {(fromCurrency === "NGN" && toCurrency === "GBP") ? safeRate.toFixed(5) : safeRate.toFixed(2)} (beats {benchmarkList.filter((item) => safeRate > item.finalRate).length}/{safePosition})
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
  );
}