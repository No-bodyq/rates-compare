// 'use client';
// import React, { useState, useEffect } from 'react';
// import { getPCXAuthToken, getExchangeRates } from '../services/auth-service';

// const ExchangeRateComponent = ({ onRatesFetched }) => {
//   const [rates, setRates] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);

//   const fetchExchangeRates = async () => {
//     try {
//       setLoading(true);
//       setError(null);
      
//       console.log('Step 1: Getting auth token (ID token)...');
//       const authResult = await getPCXAuthToken();
//       console.log('Auth result:', authResult);
      
//       console.log('Step 2: Fetching exchange rates...');
//       const ratesData = await getExchangeRates(authResult.token);
//       console.log('Rates data received, items:', Object.keys(ratesData).length);
//       setRates(ratesData);
      
//       // Pass the rates to the parent component
//       if (onRatesFetched) {
//         onRatesFetched(ratesData);
//       }
//     } catch (error) {
//       console.error('Error fetching rates:', error);
//       setError(error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Fetch rates on mount
//   useEffect(() => {
//     fetchExchangeRates();
//   }, []);

//   return (
//     <div className="p-6 max-w-4xl mx-auto">
//       <div className="mb-6">
//         <h2 className="text-2xl font-bold mb-4">PCX Exchange Rates</h2>
//         <button 
//           onClick={fetchExchangeRates} 
//           disabled={loading}
//           className="bg-green-500 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-6 rounded-lg"
//         >
//           {loading ? 'Loading...' : 'Fetch Exchange Rates'}
//         </button>
//       </div>
      
//       {error && (
//         <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
//           <strong>Error:</strong> {error}
//         </div>
//       )}
      
//       {rates && (
//         <div className="bg-gray-50 border border-gray-300 rounded-lg p-6">
//           <h3 className="text-lg font-semibold mb-4 text-green-700">
//             Exchange Rates Loaded Successfully!
//           </h3>
//           <div className="mb-4 text-sm text-gray-600">
//             <strong>Total items:</strong> {Object.keys(rates).length}
//           </div>
//           <div className="bg-white border rounded p-4 max-h-96 overflow-y-auto">
//             <pre className="text-sm text-black">
//               {JSON.stringify(rates, null, 2)}
//             </pre>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ExchangeRateComponent;