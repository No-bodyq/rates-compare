"use client";
import React from "react";
import { toast } from "react-toastify";

export default function SettingsPanel({
  showSettings,
  setShowSettings,
  defaultOrg,
  setDefaultOrg,
  fetchedOrgs,
  isDefaultOrgValid,
  setSelectedPCXOrg,
  setFetchedOrgRates,
  fetchOrgRates,
}) {
  return (
    showSettings && (
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Default Organization Settings</h3>
          <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Organization Name</label>
            <input
              type="text"
              value={defaultOrg.name}
              onChange={(e) => setDefaultOrg((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full text-black px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter organization name"
            />
            <p className="mt-1 text-xs text-gray-500">The name of the organization to select by default</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Organization ID</label>
            <input
              type="text"
              value={defaultOrg.id}
              onChange={(e) => setDefaultOrg((prev) => ({ ...prev, id: e.target.value }))}
              className="w-full text-black px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter organization ID"
            />
            <p className="mt-1 text-xs text-gray-500">The unique ID of the organization (UUID format)</p>
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
                toast.success("Reset to original default organization.", { toastId: "default-org-reset" });
              }}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Reset to Default
            </button>
            {fetchedOrgs?.data?.organizations && (
              <select
                value=""
                onChange={(e) => {
                  const selectedOrg = fetchedOrgs.data.organizations.find((org) => org.org_id === e.target.value);
                  if (selectedOrg) {
                    setDefaultOrg({
                      name: selectedOrg.org_name,
                      id: selectedOrg.org_id,
                    });
                    toast.success(`Default organization set to ${selectedOrg.org_name}.`, { toastId: "default-org-updated" });
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
                setFetchedOrgRates({});
                fetchOrgRates(defaultOrg.id, defaultOrg.name);
                toast.info(`Applied default organization "${defaultOrg.name}".`, { toastId: "default-org-applied" });
              }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
            >
              Apply Default
            </button>
          </div>
        </div>
      </div>
    )
  );
}