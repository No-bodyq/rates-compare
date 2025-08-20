"use client";
import React from "react";
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

export default function ComparisonChart({
  chartData,
  fromCurrency,
  toCurrency,
  sendAmount,
  isLoadingAllRates,
  isCurrentCorridorCrypto,
  formatCurrency,
}) {
    console.log('chartData', chartData);
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">
          Rate Comparison Chart - {fromCurrency} → {toCurrency}
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Visual comparison of all rates for {sendAmount} {fromCurrency}
        </p>
        {isLoadingAllRates && (
          <div className="text-xs text-blue-600 mt-1">Loading {isCurrentCorridorCrypto ? "crypto" : "provider"} rates...</div>
        )}
      </div>
      <div className="p-6">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={11} />
              <YAxis
                domain={[
                  isCurrentCorridorCrypto ? "dataMin - 0.00000001" : "dataMin - 5",
                  isCurrentCorridorCrypto ? "dataMax + 0.00000001" : "dataMax + 5",
                ]}
                tickFormatter={(value) => isCurrentCorridorCrypto ? value.toFixed(8) : value.toFixed(2)}
              />
              <Tooltip
                formatter={(value) => isCurrentCorridorCrypto ? value.toFixed(8) : value.toFixed(2)}
                labelFormatter={(label) => `Provider: ${label}`}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white text-black p-3 border rounded shadow-lg">
                        <p className="font-medium">{label}</p>
                        <p className="text-sm">
                          <span className="text-blue-600">Rate:</span> {isCurrentCorridorCrypto ? payload[0].value.toFixed(8) : payload[0].value.toFixed(2)}
                        </p>
                        <p className="text-sm">
                          <span className="text-green-600">Type:</span> {data.apiSource === 'crypto' ? 'Crypto' : data.type}
                        </p>
                        <p className="text-sm">
                          <span className="text-gray-600">You get:</span> {formatCurrency(parseFloat(sendAmount) * payload[0].value, toCurrency)}
                        </p>
                        <p className="text-xs text-gray-500">Last updated: {data.lastUpdate}</p>
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
            <span className="text-xs text-gray-600">Fiat Providers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span className="text-xs text-gray-600">Crypto Providers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded"></div>
            <span className="text-xs text-gray-600">PCX Organizations</span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-xs font-medium text-green-800">Providers</div>
            <div className="text-lg font-bold text-green-900">
              {chartData.filter((item) => item.type === "provider").length}
            </div>
            <div className="text-xs text-green-700">{isCurrentCorridorCrypto ? "Crypto & Fiat rates" : "Fiat rates"}</div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-xs font-medium text-blue-800">Best Rate</div>
            <div className="text-lg font-bold text-blue-900">
              {isCurrentCorridorCrypto ? chartData[0]?.finalRate.toFixed(8) : chartData[0]?.finalRate.toFixed(2)}
            </div>
            <div className="text-xs text-blue-700">{chartData[0]?.name}</div>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <div className="text-xs font-medium text-yellow-800">Avg Rate</div>
            <div className="text-lg font-bold text-yellow-900">
              {isCurrentCorridorCrypto
                ? (chartData.reduce((sum, item) => sum + item.finalRate, 0) / chartData.length).toFixed(8)
                : (chartData.reduce((sum, item) => sum + item.finalRate, 0) / chartData.length).toFixed(2)}
            </div>
            <div className="text-xs text-yellow-700">All providers</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-xs font-medium text-gray-800">Rate Spread</div>
            <div className="text-lg font-bold text-gray-900">
              {isCurrentCorridorCrypto
                ? (Math.max(...chartData.map((item) => item.finalRate)) - Math.min(...chartData.map((item) => item.finalRate))).toFixed(8)
                : (Math.max(...chartData.map((item) => item.finalRate)) - Math.min(...chartData.map((item) => item.finalRate))).toFixed(2)}
            </div>
            <div className="text-xs text-gray-700">High - Low</div>
          </div>
        </div>
      </div>
    </div>
  );
}