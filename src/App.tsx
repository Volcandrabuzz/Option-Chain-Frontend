// import React, { useState, useEffect, useRef } from 'react';
// import { io, Socket } from 'socket.io-client';
// import {
//   Chart as ChartJS,
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Title,
//   Tooltip,
//   Legend,
//   ChartOptions,
// } from 'chart.js';
// import { Line } from 'react-chartjs-2';
// import { format } from 'date-fns';
// import { Activity, Wifi, WifiOff, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

// ChartJS.register(
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Title,
//   Tooltip,
//   Legend
// );

// interface DataPoint {
//   timestamp: string;
//   pe_change: number;
//   ce_change: number;
// }

// interface ConnectionStatus {
//   connected: boolean;
//   firstFetchComplete: boolean;
//   totalPoints: number;
// }

// function App() {
//   const [data, setData] = useState<DataPoint[]>([]);
//   const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
//     connected: false,
//     firstFetchComplete: false,
//     totalPoints: 0,
//   });
//   const [lastUpdate, setLastUpdate] = useState<string>('');
//   const [isLoading, setIsLoading] = useState(true);
//   const socketRef = useRef<Socket | null>(null);

//   const SERVER_URL = 'http://localhost:5000';

//   useEffect(() => {
//     initializeConnection();
//     fetchInitialData(); // Fetch complete data on component mount

//     return () => {
//       if (socketRef.current) {
//         socketRef.current.disconnect();
//       }
//     };
//   }, []);

//   const initializeConnection = () => {
//     if (!SERVER_URL) return;

//     socketRef.current = io(SERVER_URL, {
//     transports: ['websocket', 'polling'], // Ensure fallback works
//     secure: true,
//     });

//     socketRef.current.on('connect', () => {
//       console.log('Connected to WebSocket server');
//       setConnectionStatus(prev => ({ ...prev, connected: true }));
//     });

//     socketRef.current.on('disconnect', () => {
//       console.log('Disconnected from WebSocket server');
//       setConnectionStatus(prev => ({ ...prev, connected: false }));
//     });

//     socketRef.current.on('connected', (response) => {
//       console.log('Server welcome:', response.message);
//       setConnectionStatus(prev => ({
//         ...prev,
//         totalPoints: response.total_points,
//       }));
//     });

//     socketRef.current.on('first_fetch_complete', (response) => {
//       console.log('First fetch complete:', response.message);
//       fetchInitialData(); // reload full array after initial fetch
//       setConnectionStatus(prev => ({ ...prev, firstFetchComplete: true }));
//     });

//     socketRef.current.on('new_data', (response) => {
//       console.log('New data received:', response.latest);
//       const newDataPoint = response.latest;

//       setData(prevData => {
//         // Always return new array copy
//         if (prevData.some(item => item.timestamp === newDataPoint.timestamp)) {
//           return [...prevData]; // force re-render
//         }
//         return [...prevData, newDataPoint];
//       });

//       setConnectionStatus(prev => ({ 
//         ...prev, 
//         totalPoints: response.total_points 
//       }));

//       if (newDataPoint?.timestamp) {
//         setLastUpdate(new Date(newDataPoint.timestamp).toLocaleTimeString());
//       }
//     });



//     socketRef.current.on('full_data', (response) => {
//     console.log('Full data received (manual refresh):', response.data.length, 'points');
//     setData(response.data);
//     setConnectionStatus(prev => ({ ...prev, totalPoints: response.total_points }));

//     if (response.data.length > 0) {
//       const latest = response.data[response.data.length - 1];
//       setLastUpdate(new Date(latest.timestamp).toLocaleTimeString());
//     }
//   });

//   };

//   const fetchInitialData = async () => {
//     try {
//       setIsLoading(true);
//       const response = await fetch(`${SERVER_URL}/api/data`, {
//         headers: {
//           "Content-Type": "application/json",
//           "ngrok-skip-browser-warning": "true" // 👈 bypass ngrok splash page
//         }
//       });

//       // Check if response is JSON
//       const contentType = response.headers.get("content-type");
//       if (!contentType || !contentType.includes("application/json")) {
//         const raw = await response.text();  // 👀 log actual HTML if any
//         console.warn("Non-JSON response received from", response.url);
//         console.log("Raw response:", raw);
//         return;
//       }

//       const result = await response.json();

//       if (result.success) {
//         setData(result.data);
//         setConnectionStatus(prev => ({
//           ...prev,
//           totalPoints: result.total_points
//         }));

//         if (result.data.length > 0) {
//           const latest = result.data[result.data.length - 1]; // 👈 last element
//           setLastUpdate(new Date(latest.timestamp).toLocaleTimeString()); // 👈 changed line
//         }
//       }
//     } catch (error) {
//       console.error("Error fetching initial data:", error);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const requestFullData = () => {
//     console.log('Manual refresh requested');
//     // Instead of socket emit, call the API (same as page load)
//     fetchInitialData();
//   };

//   const formatTimestamp = (timestamp: string) => {
//     try {
//       // Handle the timestamp format from NSE API
//       const date = new Date(timestamp);
//       return format(date, 'HH:mm:ss');
//     } catch {
//       // Fallback for any parsing issues
//       return timestamp.slice(-8) || timestamp;
//     }
//   };

//   const chartData = {
//     labels: data.map(item => formatTimestamp(item.timestamp)),
//     datasets: [
//       {
//         label: 'PE Change',
//         data: data.map(item => item.pe_change),
//         borderColor: '#3B82F6',
//         backgroundColor: 'rgba(59, 130, 246, 0.1)',
//         borderWidth: 2,
//         fill: false,
//         tension: 0.1,
//       },
//       {
//         label: 'CE Change',
//         data: data.map(item => item.ce_change),
//         borderColor: '#F97316',
//         backgroundColor: 'rgba(249, 115, 22, 0.1)',
//         borderWidth: 2,
//         fill: false,
//         tension: 0.1,
//       },
//     ],
//   };

//   const chartOptions: ChartOptions<'line'> = {
//     responsive: true,
//     maintainAspectRatio: false,
//     plugins: {
//       legend: {
//         position: 'top' as const,
//         labels: {
//           color: '#E5E7EB',
//           font: {
//             size: 14,
//             weight: 'bold',
//           },
//         },
//       },
//       title: {
//         display: true,
//         text: 'NIFTY Option Chain - PE & CE Changes',
//         color: '#F9FAFB',
//         font: {
//           size: 18,
//           weight: 'bold',
//         },
//       },
//       tooltip: {
//         mode: 'index',
//         intersect: false,
//         backgroundColor: 'rgba(17, 24, 39, 0.9)',
//         titleColor: '#F9FAFB',
//         bodyColor: '#E5E7EB',
//         borderColor: '#374151',
//         borderWidth: 1,
//       },
//     },
//     scales: {
//       x: {
//         grid: {
//           color: '#374151',
//         },
//         ticks: {
//           color: '#9CA3AF',
//           maxTicksLimit: 10,
//         },
//       },
//       y: {
//         grid: {
//           color: '#374151',
//         },
//         ticks: {
//           color: '#9CA3AF',
//         },
//       },
//     },
//     animation: {
//       duration: 750,
//       easing: 'easeInOutQuart',
//     },
//   };

//   const getLatestValues = () => {
//     if (data.length === 0) return { pe: 0, ce: 0 };
//     const latest = data[data.length - 1];
//     return { pe: latest.pe_change, ce: latest.ce_change };
//   };

//   const { pe: latestPE, ce: latestCE } = getLatestValues();

//   return (
//     <div className="min-h-screen bg-gray-900 text-white">
//       {/* Header */}
//       <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
//         <div className="flex items-center justify-between">
//           <div className="flex items-center space-x-4">
//             <Activity className="h-8 w-8 text-blue-500" />
//             <div>
//               <h1 className="text-2xl font-bold text-white">NIFTY Option Chain Monitor</h1>
//               <p className="text-gray-400">Real-time PE & CE Change Tracking</p>
//             </div>
//           </div>
//           <div className="flex items-center space-x-4">
//             <div className="flex items-center space-x-2">
//               {connectionStatus.connected ? (
//                 <Wifi className="h-5 w-5 text-green-500" />
//               ) : (
//                 <WifiOff className="h-5 w-5 text-red-500" />
//               )}
//               <span className="text-sm text-gray-300">
//                 {connectionStatus.connected ? 'Connected' : 'Disconnected'}
//               </span>
//             </div>
//             <button
//               onClick={requestFullData}
//               className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
//             >
//               <RefreshCw className="h-4 w-4" />
//               <span className="text-sm">Refresh</span>
//             </button>
//           </div>
//         </div>
//       </div>

//       <div className="p-6 space-y-6">
//         {/* Status Cards */}
//         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//           <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-gray-400 text-sm">Total Data Points</p>
//                 <p className="text-2xl font-bold text-white">{connectionStatus.totalPoints}</p>
//               </div>
//               <Activity className="h-8 w-8 text-blue-500" />
//             </div>
//           </div>
          
//           <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-gray-400 text-sm">Latest PE Change</p>
//                 <p className={`text-2xl font-bold ${latestPE >= 0 ? 'text-green-500' : 'text-red-500'}`}>
//                   {latestPE.toFixed(2)}
//                 </p>
//               </div>
//               {latestPE >= 0 ? (
//                 <TrendingUp className="h-8 w-8 text-green-500" />
//               ) : (
//                 <TrendingDown className="h-8 w-8 text-red-500" />
//               )}
//             </div>
//           </div>
          
//           <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-gray-400 text-sm">Latest CE Change</p>
//                 <p className={`text-2xl font-bold ${latestCE >= 0 ? 'text-green-500' : 'text-red-500'}`}>
//                   {latestCE.toFixed(2)}
//                 </p>
//               </div>
//               {latestCE >= 0 ? (
//                 <TrendingUp className="h-8 w-8 text-green-500" />
//               ) : (
//                 <TrendingDown className="h-8 w-8 text-red-500" />
//               )}
//             </div>
//           </div>
          
//           <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-gray-400 text-sm">Last Update</p>
//                 <p className="text-lg font-semibold text-white">{lastUpdate || 'No updates yet'}</p>
//               </div>
//               <RefreshCw className="h-8 w-8 text-orange-500" />
//             </div>
//           </div>
//         </div>

//         {/* Chart */}
//         <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
//           <div className="h-96 w-full">
//             {isLoading ? (
//               <div className="flex items-center justify-center h-full">
//                 <div className="flex items-center space-x-2">
//                   <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
//                   <span className="text-gray-300">Loading chart data...</span>
//                 </div>
//               </div>
//             ) : data.length > 0 ? (
//               <Line data={chartData} options={chartOptions} />
//             ) : (
//               <div className="flex items-center justify-center h-full">
//                 <p className="text-gray-400">No data available yet. Waiting for data...</p>
//               </div>
//             )}
//           </div>
//         </div>

//         {/* Data Table */}
//         <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
//           <div className="px-6 py-4 border-b border-gray-700">
//             <h3 className="text-lg font-semibold text-white">Data History</h3>
//             <p className="text-gray-400 text-sm">Latest data points ({data.length} total)</p>
//           </div>
          
//           <div className="overflow-x-auto">
//             <table className="w-full text-sm">
//               <thead className="bg-gray-700">
//                 <tr>
//                   <th className="px-6 py-3 text-left text-gray-300 font-medium">Timestamp</th>
//                   <th className="px-6 py-3 text-left text-gray-300 font-medium">PE Change</th>
//                   <th className="px-6 py-3 text-left text-gray-300 font-medium">CE Change</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-gray-700">
//                 {data.slice(-20).reverse().map((item, index) => (
//                   <tr key={index} className={`${index === 0 ? 'bg-gray-750' : 'bg-gray-800'} hover:bg-gray-700 transition-colors`}>
//                     <td className="px-6 py-3 text-gray-300">
//                       {formatTimestamp(item.timestamp)}
//                     </td>
//                     <td className={`px-6 py-3 font-semibold ${item.pe_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
//                       {item.pe_change >= 0 ? '+' : ''}{item.pe_change.toFixed(2)}
//                     </td>
//                     <td className={`px-6 py-3 font-semibold ${item.ce_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
//                       {item.ce_change >= 0 ? '+' : ''}{item.ce_change.toFixed(2)}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
            
//             {data.length === 0 && !isLoading && (
//               <div className="px-6 py-8 text-center">
//                 <p className="text-gray-400">No data available yet</p>
//                 <p className="text-gray-500 text-sm">Waiting for server to start collecting data...</p>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default App;

// import React, { useState, useEffect, useRef, useMemo } from 'react';
// import { io, Socket } from 'socket.io-client';
// import {
//   Chart as ChartJS,
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Title,
//   Tooltip,
//   Legend,
//   ChartOptions,
// } from 'chart.js';
// import { Line } from 'react-chartjs-2';
// import { format } from 'date-fns';
// import { Activity, Wifi, WifiOff, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

// ChartJS.register(
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Title,
//   Tooltip,
//   Legend
// );

// interface DataPoint {
//   timestamp: string;
//   pe_change: number;
//   ce_change: number;
// }

// interface ConnectionStatus {
//   connected: boolean;
//   firstFetchComplete: boolean;
//   totalPoints: number;
// }

// function App() {
//   const [data, setData] = useState<DataPoint[]>([]);
//   const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
//     connected: false,
//     firstFetchComplete: false,
//     totalPoints: 0,
//   });
//   const [lastUpdate, setLastUpdate] = useState<string>('');
//   const [isLoading, setIsLoading] = useState(true);
//   const socketRef = useRef<Socket | null>(null);
//   const chartRef = useRef<any>(null);


//   const SERVER_URL = 'http://localhost:5000';

//   useEffect(() => {
//     initializeConnection();
//     fetchInitialData();

//     return () => {
//       if (socketRef.current) {
//         socketRef.current.disconnect();
//       }
//     };
//   }, []);

//   const initializeConnection = () => {
//     socketRef.current = io(SERVER_URL, {
//       transports: ['websocket', 'polling'],
//       reconnection: true,
//       reconnectionDelay: 1000,
//       reconnectionAttempts: 10
//     });

//     socketRef.current.on('connect', () => {
//       console.log('✅ Connected to server');
//       setConnectionStatus(prev => ({ ...prev, connected: true }));
//     });

//     socketRef.current.on('disconnect', () => {
//       console.log('❌ Disconnected from server');
//       setConnectionStatus(prev => ({ ...prev, connected: false }));
//     });

//     socketRef.current.on('connected', (response) => {
//       console.log('Server welcome:', response.message);
//       setConnectionStatus(prev => ({
//         ...prev,
//         totalPoints: response.total_points || 0,
//       }));
//     });

//     socketRef.current.on('first_fetch_complete', (response) => {
//       console.log('First fetch complete:', response.message);
//       setConnectionStatus(prev => ({ ...prev, firstFetchComplete: true }));
//       // Reload data after first fetch
//       setTimeout(() => fetchInitialData(), 1000);
//     });

//     socketRef.current.on('new_data', (response) => {
//       console.log('🆕 New data received:', response.latest);
//       const newDataPoint = response.latest;

//       // Update data array
//       setData(prevData => {
//         // Check if this timestamp already exists
//         const exists = prevData.find(item => item.timestamp === newDataPoint.timestamp);
//         if (exists) {
//           return prevData; // Don't add duplicate
//         }
//         // Add new data point
//         return [...prevData, newDataPoint];
//       });

//       // Update total points
//       setConnectionStatus(prev => ({ 
//         ...prev, 
//         totalPoints: response.total_points 
//       }));

//       // Update last update time
//       if (newDataPoint?.timestamp) {
//         try {
//           // Parse NSE timestamp format: "29-Sep-2025 09:16:00"
//           const parts = newDataPoint.timestamp.split(' ');
//           const datePart = parts[0]; // "29-Sep-2025"
//           const timePart = parts[1]; // "09:16:00"
          
//           // Use just the time part for display
//           setLastUpdate(timePart);
//         } catch (e) {
//           console.error('Error parsing timestamp:', e);
//           setLastUpdate(newDataPoint.timestamp);
//         }
//       }
//     });

//     socketRef.current.on('full_data', (response) => {
//       console.log('📦 Full data received:', response.data?.length || 0, 'points');
//       if (response.data) {
//         setData(response.data);
//         setConnectionStatus(prev => ({ 
//           ...prev, 
//           totalPoints: response.total_points || response.data.length 
//         }));

//         if (response.data.length > 0) {
//           const latest = response.data[response.data.length - 1];
//           try {
//             const parts = latest.timestamp.split(' ');
//             const timePart = parts[1];
//             setLastUpdate(timePart);
//           } catch (e) {
//             setLastUpdate(latest.timestamp);
//           }
//         }
//       }
//     });
//   };

//   const fetchInitialData = async () => {
//     try {
//       setIsLoading(true);
//       const response = await fetch(`${SERVER_URL}/api/data`);

//       if (!response.ok) {
//         console.error('API request failed:', response.status);
//         return;
//       }

//       const contentType = response.headers.get("content-type");
//       if (!contentType || !contentType.includes("application/json")) {
//         console.error("Non-JSON response received");
//         return;
//       }

//       const result = await response.json();

//       if (result.success && result.data) {
//         setData(result.data);
//         setConnectionStatus(prev => ({
//           ...prev,
//           totalPoints: result.total_points || result.data.length
//         }));

//         if (result.data.length > 0) {
//           const latest = result.data[result.data.length - 1];
//           try {
//             const parts = latest.timestamp.split(' ');
//             const timePart = parts[1];
//             setLastUpdate(timePart);
//           } catch (e) {
//             setLastUpdate(latest.timestamp);
//           }
//         }
//       }
//     } catch (error) {
//       console.error("Error fetching initial data:", error);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const requestFullData = () => {
//     console.log('🔄 Manual refresh requested');
//     fetchInitialData();
//   };

//   const formatTimestamp = (timestamp: string) => {
//     try {
//       // NSE format: "29-Sep-2025 09:16:00"
//       const parts = timestamp.split(' ');
//       if (parts.length >= 2) {
//         return parts[1]; // Return just the time part
//       }
//       return timestamp;
//     } catch {
//       return timestamp;
//     }
//   };

//   const chartData = useMemo(() => ({
//     labels: data.map(item => formatTimestamp(item.timestamp)),
//     datasets: [
//       {
//         label: 'PE Change',
//         data: data.map(item => item.pe_change),
//         borderColor: '#3B82F6',
//         backgroundColor: 'rgba(59, 130, 246, 0.1)',
//         borderWidth: 2,
//         fill: false,
//         tension: 0.1,
//         pointRadius: 0,          // 🔹 Hide the circle markers
//         pointHoverRadius: 0,     // 🔹 Don’t show points even on hover

//       },
//       {
//         label: 'CE Change',
//         data: data.map(item => item.ce_change),
//         borderColor: '#F97316',
//         backgroundColor: 'rgba(249, 115, 22, 0.1)',
//         borderWidth: 2,
//         fill: false,
//         tension: 0.1,
//         pointRadius: 0,          // 🔹 Hide the circle markers
//         pointHoverRadius: 0,     // 🔹 Don’t show points even on hover

//       },
//     ],
//   }), [data]);

//   // 🔽 ADD THIS BLOCK HERE
//   useEffect(() => {
//     if (chartRef.current) {
//       chartRef.current.update();
//     }
//   }, [chartData]);


//   const chartOptions: ChartOptions<'line'> = {
//     responsive: true,
//     maintainAspectRatio: false,
//     plugins: {
//       legend: {
//         position: 'top' as const,
//         labels: {
//           color: '#E5E7EB',
//           font: {
//             size: 14,
//             weight: 'bold',
//           },
//         },
//       },
//       title: {
//         display: true,
//         text: 'NIFTY Option Chain - PE & CE Changes',
//         color: '#F9FAFB',
//         font: {
//           size: 18,
//           weight: 'bold',
//         },
//       },
//       tooltip: {
//         mode: 'index',
//         intersect: false,
//         backgroundColor: 'rgba(17, 24, 39, 0.9)',
//         titleColor: '#F9FAFB',
//         bodyColor: '#E5E7EB',
//         borderColor: '#374151',
//         borderWidth: 1,
//       },
//     },
//     scales: {
//       x: {
//         grid: {
//           color: '#374151',
//         },
//         ticks: {
//           color: '#9CA3AF',
//           maxTicksLimit: 10,
//         },
//       },
//       y: {
//         grid: {
//           color: '#374151',
//         },
//         ticks: {
//           color: '#9CA3AF',
//         },
//       },
//     },
//     animation: {
//       duration: 750,
//       easing: 'easeInOutQuart',
//     },
//   };

//   return (
//     <div className="min-h-screen bg-gray-900 text-white">
//       {/* Header */}
//       <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
//         <div className="flex items-center justify-between">
//           <div className="flex items-center space-x-4">
//             <Activity className="h-8 w-8 text-blue-500" />
//             <div>
//               <h1 className="text-2xl font-bold text-white">NIFTY Option Chain Monitor</h1>
//               <p className="text-gray-400">Real-time PE & CE Change Tracking</p>
//             </div>
//           </div>
//           <div className="flex items-center space-x-4">
//             <div className="flex items-center space-x-2">
//               {connectionStatus.connected ? (
//                 <Wifi className="h-5 w-5 text-green-500" />
//               ) : (
//                 <WifiOff className="h-5 w-5 text-red-500" />
//               )}
//               <span className="text-sm text-gray-300">
//                 {connectionStatus.connected ? 'Connected' : 'Disconnected'}
//               </span>
//             </div>
//             <button
//               onClick={requestFullData}
//               className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
//             >
//               <RefreshCw className="h-4 w-4" />
//               <span className="text-sm">Refresh</span>
//             </button>
//           </div>
//         </div>
//       </div>

//       <div className="p-6">
//         <div className="grid grid-cols-2 gap-8 w-full">
          
//           {/* Left: Chart Section */}
//           <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
//             <div className="h-96 w-full">
//               {isLoading ? (
//                 <div className="flex items-center justify-center h-full">
//                   <div className="flex items-center space-x-2">
//                     <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
//                     <span className="text-gray-300">Loading chart data...</span>
//                   </div>
//                 </div>
//               ) : data.length > 0 ? (
//                 <Line ref={chartRef} data={chartData} options={chartOptions} />
//               ) : (
//                 <div className="flex items-center justify-center h-full">
//                   <p className="text-gray-400">No data available yet. Waiting for data...</p>
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* Right: Placeholder / Second Section */}
//           <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
//             <div className="h-96 w-full">
//               {isLoading ? (
//                 <div className="flex items-center justify-center h-full">
//                   <div className="flex items-center space-x-2">
//                     <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
//                     <span className="text-gray-300">Loading right section data...</span>
//                   </div>
//                 </div>
//               ) : data.length > 0 ? (
//                 <div className="flex items-center justify-center h-full text-gray-300">
//                   {/* Replace this later with your right side visualization */}
//                   <p>Right side content loaded successfully</p>
//                 </div>
//               ) : (
//                 <div className="flex items-center justify-center h-full">
//                   <p className="text-gray-400">No data available yet. Waiting for data...</p>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default App

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Activity, Wifi, WifiOff, RefreshCw } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DataPoint {
  timestamp: string;
  pe_change: number;
  ce_change: number;
}

interface StrikeData {
  [strike: string]: number[];
}

interface ConnectionStatus {
  connected: boolean;
  firstFetchComplete: boolean;
  totalPoints: number;
}

// Color palette for different strikes
const STRIKE_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#84CC16', // Lime
];

function App() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    firstFetchComplete: false,
    totalPoints: 0,
  });
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Strike price states
  const [top5CEStrikes, setTop5CEStrikes] = useState<number[]>([]);
  const [top5PEStrikes, setTop5PEStrikes] = useState<number[]>([]);
  const [currentTopCE, setCurrentTopCE] = useState<number | null>(null);
  const [currentTopPE, setCurrentTopPE] = useState<number | null>(null);
  
  // Arrays for strike data
  const [ceArrays, setCeArrays] = useState<StrikeData>({});
  const [peArrays, setPeArrays] = useState<StrikeData>({});
  const [underlyingArray, setUnderlyingArray] = useState<number[]>([]);
  
  // User selections (manually checked boxes)
  const [userSelectedCE, setUserSelectedCE] = useState<Set<number>>(new Set());
  const [userSelectedPE, setUserSelectedPE] = useState<Set<number>>(new Set());
  
  // Timestamps for x-axis
  const [timestamps, setTimestamps] = useState<string[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const chartRef = useRef<any>(null);
  const strikeChartRef = useRef<any>(null);

  const SERVER_URL = 'http://localhost:5000';

  useEffect(() => {
    initializeConnection();
    fetchInitialData();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const initializeConnection = () => {
    socketRef.current = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server');
      setConnectionStatus(prev => ({ ...prev, connected: true }));
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setConnectionStatus(prev => ({ ...prev, connected: false }));
    });

    socketRef.current.on('connected', (response) => {
      console.log('Server welcome:', response.message);
      setConnectionStatus(prev => ({
        ...prev,
        totalPoints: response.total_points || 0,
      }));
    });

    socketRef.current.on('first_fetch_complete', (response) => {
      console.log('First fetch complete:', response);
      setConnectionStatus(prev => ({ ...prev, firstFetchComplete: true }));
      
      // Set top 5 strikes
      setTop5CEStrikes(response.top_5_ce_strikes || []);
      setTop5PEStrikes(response.top_5_pe_strikes || []);
      setCurrentTopCE(response.current_top_ce);
      setCurrentTopPE(response.current_top_pe);
      
      // Initialize arrays
      setCeArrays(response.ce_oi_arrays || {});
      setPeArrays(response.pe_oi_arrays || {});
      setUnderlyingArray(response.underlying_diff_array || [0]);
      
      setTimeout(() => fetchInitialData(), 1000);
    });

    socketRef.current.on('new_data', (response) => {
      console.log('🆕 New data received:', response);
      const newDataPoint = response.latest;

      // Update PE/CE change data
      setData(prevData => {
        const exists = prevData.find(item => item.timestamp === newDataPoint.timestamp);
        if (exists) return prevData;
        return [...prevData, newDataPoint];
      });

      // Update timestamps
      setTimestamps(prev => {
        const timeStr = formatTimestamp(newDataPoint.timestamp);
        if (prev.includes(timeStr)) return prev;
        return [...prev, timeStr];
      });

      // Update topmost strikes
      setCurrentTopCE(response.current_top_ce);
      setCurrentTopPE(response.current_top_pe);

      // Update arrays for topmost strikes
      if (response.current_top_ce && response.ce_oi_array) {
        setCeArrays(prev => ({
          ...prev,
          [response.current_top_ce]: response.ce_oi_array
        }));
      }

      if (response.current_top_pe && response.pe_oi_array) {
        setPeArrays(prev => ({
          ...prev,
          [response.current_top_pe]: response.pe_oi_array
        }));
      }

      // Update user-selected arrays
      if (response.ce_user_selected_arrays) {
        setCeArrays(prev => ({
          ...prev,
          ...response.ce_user_selected_arrays
        }));
      }

      if (response.pe_user_selected_arrays) {
        setPeArrays(prev => ({
          ...prev,
          ...response.pe_user_selected_arrays
        }));
      }

      // Update underlying array
      if (response.underlying_diff_array) {
        setUnderlyingArray(response.underlying_diff_array);
      }

      // Update connection status
      setConnectionStatus(prev => ({ 
        ...prev, 
        totalPoints: response.total_points 
      }));

      if (newDataPoint?.timestamp) {
        try {
          const parts = newDataPoint.timestamp.split(' ');
          const timePart = parts[1];
          setLastUpdate(timePart);
        } catch (e) {
          setLastUpdate(newDataPoint.timestamp);
        }
      }
    });

    socketRef.current.on('selected_strikes_updated', (response) => {
      console.log('📌 User selected strikes updated:', response);
      
      // Update arrays for user-selected strikes
      if (response.ce_arrays) {
        setCeArrays(prev => ({ ...prev, ...response.ce_arrays }));
      }
      if (response.pe_arrays) {
        setPeArrays(prev => ({ ...prev, ...response.pe_arrays }));
      }
    });

    socketRef.current.on('full_data', (response) => {
      console.log('📦 Full data received:', response.data?.length || 0, 'points');
      if (response.data) {
        setData(response.data);
        setConnectionStatus(prev => ({ 
          ...prev, 
          totalPoints: response.total_points || response.data.length 
        }));

        // Extract timestamps
        const times = response.data.map((d: DataPoint) => formatTimestamp(d.timestamp));
        setTimestamps(times);

        if (response.data.length > 0) {
          const latest = response.data[response.data.length - 1];
          try {
            const parts = latest.timestamp.split(' ');
            const timePart = parts[1];
            setLastUpdate(timePart);
          } catch (e) {
            setLastUpdate(latest.timestamp);
          }
        }

        // Update strike data if available
        if (response.top_5_ce_strikes) setTop5CEStrikes(response.top_5_ce_strikes);
        if (response.top_5_pe_strikes) setTop5PEStrikes(response.top_5_pe_strikes);
        if (response.current_top_ce) setCurrentTopCE(response.current_top_ce);
        if (response.current_top_pe) setCurrentTopPE(response.current_top_pe);
        if (response.ce_oi_arrays) setCeArrays(response.ce_oi_arrays);
        if (response.pe_oi_arrays) setPeArrays(response.pe_oi_arrays);
        if (response.underlying_diff_array) setUnderlyingArray(response.underlying_diff_array);
      }
    });
  };

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${SERVER_URL}/api/data`);

      if (!response.ok) {
        console.error('API request failed:', response.status);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Non-JSON response received");
        return;
      }

      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setConnectionStatus(prev => ({
          ...prev,
          totalPoints: result.total_points || result.data.length
        }));

        // Extract timestamps
        const times = result.data.map((d: DataPoint) => formatTimestamp(d.timestamp));
        setTimestamps(times);

        if (result.data.length > 0) {
          const latest = result.data[result.data.length - 1];
          try {
            const parts = latest.timestamp.split(' ');
            const timePart = parts[1];
            setLastUpdate(timePart);
          } catch (e) {
            setLastUpdate(latest.timestamp);
          }
        }

        // Load strike data
        if (result.top_5_ce_strikes) setTop5CEStrikes(result.top_5_ce_strikes);
        if (result.top_5_pe_strikes) setTop5PEStrikes(result.top_5_pe_strikes);
        if (result.current_top_ce) setCurrentTopCE(result.current_top_ce);
        if (result.current_top_pe) setCurrentTopPE(result.current_top_pe);
        if (result.ce_oi_arrays) setCeArrays(result.ce_oi_arrays);
        if (result.pe_oi_arrays) setPeArrays(result.pe_oi_arrays);
        if (result.underlying_diff_array) setUnderlyingArray(result.underlying_diff_array);
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestFullData = () => {
    console.log('🔄 Manual refresh requested');
    fetchInitialData();
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const parts = timestamp.split(' ');
      if (parts.length >= 2) {
        return parts[1];
      }
      return timestamp;
    } catch {
      return timestamp;
    }
  };

  // Handle checkbox change for CE strikes
  const handleCECheckbox = (strike: number, isChecked: boolean) => {
    const newSelected = new Set(userSelectedCE);
    
    if (isChecked) {
      newSelected.add(strike);
    } else {
      newSelected.delete(strike);
    }
    
    setUserSelectedCE(newSelected);
    
    // Notify backend
    if (socketRef.current) {
      socketRef.current.emit('update_selected_strikes', {
        selected_ce_strikes: Array.from(newSelected),
        selected_pe_strikes: Array.from(userSelectedPE)
      });
    }
  };

  // Handle checkbox change for PE strikes
  const handlePECheckbox = (strike: number, isChecked: boolean) => {
    const newSelected = new Set(userSelectedPE);
    
    if (isChecked) {
      newSelected.add(strike);
    } else {
      newSelected.delete(strike);
    }
    
    setUserSelectedPE(newSelected);
    
    // Notify backend
    if (socketRef.current) {
      socketRef.current.emit('update_selected_strikes', {
        selected_ce_strikes: Array.from(userSelectedCE),
        selected_pe_strikes: Array.from(newSelected)
      });
    }
  };

  // Check if a strike should be checked (either topmost or user-selected)
  const isCEChecked = (strike: number) => {
    return strike === currentTopCE || userSelectedCE.has(strike);
  };

  const isPEChecked = (strike: number) => {
    return strike === currentTopPE || userSelectedPE.has(strike);
  };

  // Left chart data (PE/CE changes)
  const chartData = useMemo(() => ({
    labels: data.map(item => formatTimestamp(item.timestamp)),
    datasets: [
      {
        label: 'PE Change',
        data: data.map(item => item.pe_change),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
      {
        label: 'CE Change',
        data: data.map(item => item.ce_change),
        borderColor: '#F97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ],
  }), [data]);

  // Right chart data (Strike OI changes + Underlying)
  const strikeChartData = useMemo(() => {
    const datasets: any[] = [];
    let colorIndex = 0;

    // Add underlying array (always black)
    if (underlyingArray.length > 0) {
      datasets.push({
        label: 'Underlying Diff',
        data: underlyingArray,
        borderColor: '#000000',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 0,
      });
    }

    // Add CE strikes that are checked (topmost or user-selected)
    top5CEStrikes.forEach((strike) => {
      if (isCEChecked(strike) && ceArrays[strike]) {
        const isTop = strike === currentTopCE;
        datasets.push({
          label: `CE ${strike}${isTop ? ' ⭐' : ''}`,
          data: ceArrays[strike],
          borderColor: STRIKE_COLORS[colorIndex % STRIKE_COLORS.length],
          backgroundColor: `${STRIKE_COLORS[colorIndex % STRIKE_COLORS.length]}20`,
          borderWidth: isTop ? 3 : 2,
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 0,
        });
        colorIndex++;
      }
    });

    // Add PE strikes that are checked (topmost or user-selected)
    top5PEStrikes.forEach((strike) => {
      if (isPEChecked(strike) && peArrays[strike]) {
        const isTop = strike === currentTopPE;
        datasets.push({
          label: `PE ${strike}${isTop ? ' ⭐' : ''}`,
          data: peArrays[strike],
          borderColor: STRIKE_COLORS[colorIndex % STRIKE_COLORS.length],
          backgroundColor: `${STRIKE_COLORS[colorIndex % STRIKE_COLORS.length]}20`,
          borderWidth: isTop ? 3 : 2,
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 0,
        });
        colorIndex++;
      }
    });

    return {
      labels: timestamps,
      datasets,
    };
  }, [timestamps, underlyingArray, ceArrays, peArrays, top5CEStrikes, top5PEStrikes, currentTopCE, currentTopPE, userSelectedCE, userSelectedPE]);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update();
    }
  }, [chartData]);

  useEffect(() => {
    if (strikeChartRef.current) {
      strikeChartRef.current.update();
    }
  }, [strikeChartData]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#E5E7EB',
          font: {
            size: 14,
            weight: 'bold',
          },
        },
      },
      title: {
        display: true,
        text: 'NIFTY Option Chain - PE & CE Changes',
        color: '#F9FAFB',
        font: {
          size: 18,
          weight: 'bold',
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#F9FAFB',
        bodyColor: '#E5E7EB',
        borderColor: '#374151',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          color: '#374151',
        },
        ticks: {
          color: '#9CA3AF',
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: {
          color: '#374151',
        },
        ticks: {
          color: '#9CA3AF',
        },
      },
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart',
    },
  };

  const strikeChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#E5E7EB',
          font: {
            size: 12,
            weight: 'bold',
          },
        },
      },
      title: {
        display: true,
        text: 'Strike OI Changes & Underlying Movement',
        color: '#F9FAFB',
        font: {
          size: 18,
          weight: 'bold',
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#F9FAFB',
        bodyColor: '#E5E7EB',
        borderColor: '#374151',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          color: '#374151',
        },
        ticks: {
          color: '#9CA3AF',
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: {
          color: '#374151',
        },
        ticks: {
          color: '#9CA3AF',
        },
      },
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart',
    },
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Activity className="h-8 w-8 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">NIFTY Option Chain Monitor</h1>
              <p className="text-gray-400">Real-time PE & CE Change Tracking</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {connectionStatus.connected ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              <span className="text-sm text-gray-300">
                {connectionStatus.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {lastUpdate && (
              <div className="text-sm text-gray-400">
                Last Update: <span className="text-white font-mono">{lastUpdate}</span>
              </div>
            )}
            <button
              onClick={requestFullData}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-8 w-full">
          
          {/* Left: PE/CE Change Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="h-96 w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="text-gray-300">Loading chart data...</span>
                  </div>
                </div>
              ) : data.length > 0 ? (
                <Line ref={chartRef} data={chartData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400">No data available yet. Waiting for data...</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Strike Selection + Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            {/* Strike Checkboxes */}
            <div className="mb-4 space-y-3">
              {/* CE Strikes */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2">CE Strikes:</h3>
                <div className="flex flex-wrap gap-3">
                  {top5CEStrikes.map((strike) => {
                    const isTop = strike === currentTopCE;
                    const isChecked = isCEChecked(strike);
                    
                    return (
                      <label
                        key={`ce-${strike}`}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-md border cursor-pointer transition-all ${
                          isTop 
                            ? 'bg-blue-600 border-blue-500 text-white font-semibold' 
                            : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            // Don't allow unchecking topmost strike
                            if (isTop) return;
                            handleCECheckbox(strike, e.target.checked);
                          }}
                          disabled={isTop}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">
                          {strike} {isTop && '⭐'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* PE Strikes */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2">PE Strikes:</h3>
                <div className="flex flex-wrap gap-3">
                  {top5PEStrikes.map((strike) => {
                    const isTop = strike === currentTopPE;
                    const isChecked = isPEChecked(strike);
                    
                    return (
                      <label
                        key={`pe-${strike}`}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-md border cursor-pointer transition-all ${
                          isTop 
                            ? 'bg-orange-600 border-orange-500 text-white font-semibold' 
                            : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            // Don't allow unchecking topmost strike
                            if (isTop) return;
                            handlePECheckbox(strike, e.target.checked);
                          }}
                          disabled={isTop}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">
                          {strike} {isTop && '⭐'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Strike Chart */}
            <div className="h-80 w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="text-gray-300">Loading strike data...</span>
                  </div>
                </div>
              ) : timestamps.length > 0 ? (
                <Line ref={strikeChartRef} data={strikeChartData} options={strikeChartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400">No strike data available yet. Waiting for data...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400">Total Data Points</div>
            <div className="text-2xl font-bold text-white mt-1">
              {connectionStatus.totalPoints}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400">Current Top CE</div>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              {currentTopCE || '-'}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400">Current Top PE</div>
            <div className="text-2xl font-bold text-orange-400 mt-1">
              {currentTopPE || '-'}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400">Active Strikes</div>
            <div className="text-2xl font-bold text-green-400 mt-1">
              {(userSelectedCE.size + userSelectedPE.size + 2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;