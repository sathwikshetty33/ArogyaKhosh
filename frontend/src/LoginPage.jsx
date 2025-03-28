// import { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// const path="http://127.0.0.1:8000";


// const LoginPage = () => {
//   const [activeTab, setActiveTab] = useState('patient');
//   const [username, setUsername] = useState('');
//   const [password, setPassword] = useState('');
//   const [metaMaskId, setMetaMaskId] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [statusCode, setStatusCode] = useState(null);
  
//   const navigate = useNavigate();

//   const connectMetaMask = async () => {
//     setError('');
    
//     if (typeof window.ethereum === 'undefined') {
//       setError('MetaMask is not installed. Please install MetaMask to continue.');
//       return;
//     }
    
//     try {
//       const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
//       setMetaMaskId(accounts[0]);
//       return accounts[0];
//     } catch (error) {
//       setError('Failed to connect to MetaMask. Please try again.');
//       console.error(error);
//       return null;
//     }
//   };

//   const handleLogin = async (e) => {
//     e.preventDefault();
//     setError('');
//     setIsLoading(true);
    
//     let endpoint = '';
//     let requestBody = {};
    
//     switch (activeTab) {
//       case 'hospital':
//         endpoint = `${path}/hospital-login/`;
        
//         // Verify MetaMask for hospital login
//         const hospitalMetaMaskAccount = metaMaskId || await connectMetaMask();
//         if (!hospitalMetaMaskAccount) {
//           setIsLoading(false);
//           return;
//         }
        
//         requestBody = {
//           username,
//           password,
//           metamask_id: hospitalMetaMaskAccount
//         };
//         break;
        
//       case 'doctor':
//         endpoint = `${path}/doctor-login/`;
        
//         // Verify MetaMask for doctor login
//         const doctorMetaMaskAccount = metaMaskId || await connectMetaMask();
//         if (!doctorMetaMaskAccount) {
//           setIsLoading(false);
//           return;
//         }
        
//         requestBody = {
//           username,
//           password,
//           metamask_id: doctorMetaMaskAccount
//         };
//         break;
        
//       case 'patient':
//         endpoint = `${path}/patient-login/`;
//         requestBody = {
//           username,
//           password
//         };
//         break;
        
//       default:
//         setError('Invalid login type');
//         setIsLoading(false);
//         return;
//     }
    
//     try {
//       const response = await fetch(endpoint, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(requestBody),
//       });
      
//       setStatusCode(response.status);
      
//       if (response.ok) {
//         const data = await response.json();
//         localStorage.setItem('token', data.token);
//         localStorage.setItem('userType', activeTab);
        
//         // Redirect based on user type
//         navigate(`/${activeTab}-dashboard`);
//       } else {
//         const errorData = await response.json();
//         setError(errorData.message || 'Login failed. Please check your credentials.');
//       }
//     } catch (error) {
//       setError('Network error. Please try again later.');
//       console.error(error);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gray-50">
//       <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
//         <h1 className="text-3xl font-bold text-center text-blue-600 mb-6">Healthcare Login</h1>
        
//         {/* Status Code Display */}
//         {statusCode && (
//           <div className={`mb-4 text-center p-2 rounded ${
//             statusCode >= 200 && statusCode < 300 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
//           }`}>
//             Status Code: {statusCode}
//           </div>
//         )}
        
//         {/* Login Type Tabs */}
//         <div className="flex border-b border-gray-200 mb-6">
//           <button
//             className={`flex-1 py-2 font-medium ${
//               activeTab === 'patient' 
//                 ? 'text-blue-600 border-b-2 border-blue-600' 
//                 : 'text-gray-500 hover:text-blue-500'
//             }`}
//             onClick={() => setActiveTab('patient')}
//           >
//             Patient
//           </button>
//           <button
//             className={`flex-1 py-2 font-medium ${
//               activeTab === 'doctor' 
//                 ? 'text-blue-600 border-b-2 border-blue-600' 
//                 : 'text-gray-500 hover:text-blue-500'
//             }`}
//             onClick={() => setActiveTab('doctor')}
//           >
//             Doctor
//           </button>
//           <button
//             className={`flex-1 py-2 font-medium ${
//               activeTab === 'hospital' 
//                 ? 'text-blue-600 border-b-2 border-blue-600' 
//                 : 'text-gray-500 hover:text-blue-500'
//             }`}
//             onClick={() => setActiveTab('hospital')}
//           >
//             Hospital
//           </button>
//         </div>
        
//         {error && (
//           <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
//             {error}
//           </div>
//         )}
        
//         <form onSubmit={handleLogin}>
//           <div className="mb-4">
//             <label htmlFor="username" className="block text-gray-700 font-medium mb-2">
//               Username
//             </label>
//             <input
//               type="text"
//               id="username"
//               className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//               placeholder="Enter your username"
//               value={username}
//               onChange={(e) => setUsername(e.target.value)}
//               required
//             />
//           </div>
          
//           <div className="mb-6">
//             <label htmlFor="password" className="block text-gray-700 font-medium mb-2">
//               Password
//             </label>
//             <input
//               type="password"
//               id="password"
//               className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//               placeholder="Enter your password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               required
//             />
//           </div>
          
//           {/* MetaMask Integration for Doctor and Hospital */}
//           {(activeTab === 'doctor' || activeTab === 'hospital') && (
//             <div className="mb-6">
//               <div className="flex items-center justify-between">
//                 <label className="block text-gray-700 font-medium mb-2">
//                   MetaMask Verification
//                 </label>
//                 <button
//                   type="button"
//                   onClick={connectMetaMask}
//                   className="text-sm text-blue-600 hover:text-blue-800"
//                 >
//                   Connect Wallet
//                 </button>
//               </div>
//               {metaMaskId ? (
//                 <div className="p-3 bg-green-100 text-green-700 rounded-md truncate">
//                   Connected: {metaMaskId}
//                 </div>
//               ) : (
//                 <div className="p-3 bg-gray-100 text-gray-700 rounded-md">
//                   Please connect your MetaMask wallet
//                 </div>
//               )}
//             </div>
//           )}
          
//           <button
//             type="submit"
//             className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150"
//             disabled={isLoading || ((activeTab === 'doctor' || activeTab === 'hospital') && !metaMaskId)}
//           >
//             {isLoading ? 'Logging in...' : 'Login'}
//           </button>
//         </form>
        
//         <div className="mt-4 text-center">
//           <a href="#" className="text-sm text-blue-600 hover:text-blue-800">
//             Forgot password?
//           </a>
//         </div>
        
//         <div className="mt-6 border-t border-gray-200 pt-4 text-center">
//           <p className="text-sm text-gray-600">
//             Need an account?{' '}
//             <a href="#" className="font-medium text-blue-600 hover:text-blue-800">
//               Register here
//             </a>
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default LoginPage;


// import { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';

// const EnhancedLoginPage = () => {
//   const [activeTab, setActiveTab] = useState('patient');
//   const [username, setUsername] = useState('');
//   const [password, setPassword] = useState('');
//   const [metaMaskId, setMetaMaskId] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [statusCode, setStatusCode] = useState(null);
//   const [showAnimation, setShowAnimation] = useState(false);
  
//   const navigate = useNavigate();
//   const path = "http://127.0.0.1:8000";

//   // Animation effect when component mounts
//   useEffect(() => {
//     setShowAnimation(true);
//   }, []);

//   const connectMetaMask = async () => {
//     setError('');
    
//     if (typeof window.ethereum === 'undefined') {
//       setError('MetaMask is not installed. Please install MetaMask to continue.');
//       return;
//     }
    
//     try {
//       const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
//       setMetaMaskId(accounts[0]);
//       return accounts[0];
//     } catch (error) {
//       setError('Failed to connect to MetaMask. Please try again.');
//       console.error(error);
//       return null;
//     }
//   };

//   const handleLogin = async (e) => {
//     e.preventDefault();
//     setError('');
//     setIsLoading(true);
    
//     let endpoint = '';
//     let requestBody = {};
    
//     switch (activeTab) {
//       case 'hospital':
//         endpoint = `${path}/hospital-login/`;
        
//         const hospitalMetaMaskAccount = metaMaskId || await connectMetaMask();
//         if (!hospitalMetaMaskAccount) {
//           setIsLoading(false);
//           return;
//         }
        
//         requestBody = {
//           username,
//           password,
//           metamask_id: hospitalMetaMaskAccount
//         };
//         break;
        
//       case 'doctor':
//         endpoint = `${path}/doctor-login/`;
        
//         const doctorMetaMaskAccount = metaMaskId || await connectMetaMask();
//         if (!doctorMetaMaskAccount) {
//           setIsLoading(false);
//           return;
//         }
        
//         requestBody = {
//           username,
//           password,
//           metamask_id: doctorMetaMaskAccount
//         };
//         break;
        
//       case 'patient':
//         endpoint = `${path}/patient-login/`;
//         requestBody = {
//           username,
//           password
//         };
//         break;
        
//       default:
//         setError('Invalid login type');
//         setIsLoading(false);
//         return;
//     }
    
//     try {
//       // Simulate API call for demonstration
//       setTimeout(() => {
//         setIsLoading(false);
//         setStatusCode(200);
//         localStorage.setItem('token', 'demo-token');
//         localStorage.setItem('userType', activeTab);
//         navigate(`/${activeTab}-dashboard`);
//       }, 1500);
      
//     } catch (error) {
//       setError('Network error. Please try again later.');
//       console.error(error);
//       setIsLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
//       <div 
//         className={`max-w-md w-full bg-white rounded-xl shadow-xl overflow-hidden transition-all duration-500 transform ${
//           showAnimation ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
//         }`}
//       >
//         {/* Header with Logo */}
//         <div className="bg-indigo-600 p-6 text-center">
//           <h1 className="text-3xl font-bold text-white">HORIZON</h1>
//           <p className="text-indigo-100 mt-1">Healthcare Dashboard</p>
//         </div>
        
//         <div className="p-6">
//           {/* Status Code Display with animation */}
//           {statusCode && (
//             <div 
//               className={`mb-4 text-center p-3 rounded-lg transition-all duration-300 transform ${
//                 statusCode >= 200 && statusCode < 300 
//                   ? 'bg-green-100 text-green-800 animate-pulse' 
//                   : 'bg-red-100 text-red-800'
//               }`}
//             >
//               {statusCode >= 200 && statusCode < 300 
//                 ? 'Login successful! Redirecting...' 
//                 : `Error ${statusCode}: Login failed`}
//             </div>
//           )}
          
//           {/* Login Type Tabs */}
//           <div className="flex border-b border-gray-200 mb-6">
//             {['patient', 'doctor', 'hospital'].map((tab) => (
//               <button
//                 key={tab}
//                 className={`flex-1 py-3 font-medium capitalize transition-all duration-300 ${
//                   activeTab === tab 
//                     ? 'text-indigo-600 border-b-2 border-indigo-600' 
//                     : 'text-gray-500 hover:text-indigo-500'
//                 }`}
//                 onClick={() => setActiveTab(tab)}
//               >
//                 {tab}
//               </button>
//             ))}
//           </div>
          
//           {error && (
//             <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md animate-pulse">
//               {error}
//             </div>
//           )}
          
//           <form onSubmit={handleLogin} className="space-y-5">
//             <div>
//               <label htmlFor="username" className="block text-gray-700 font-medium mb-2">
//                 Username
//               </label>
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
//                     <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
//                   </svg>
//                 </div>
//                 <input
//                   type="text"
//                   id="username"
//                   className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300"
//                   placeholder="Enter your username"
//                   value={username}
//                   onChange={(e) => setUsername(e.target.value)}
//                   required
//                 />
//               </div>
//             </div>
            
//             <div>
//               <label htmlFor="password" className="block text-gray-700 font-medium mb-2">
//                 Password
//               </label>
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
//                     <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
//                   </svg>
//                 </div>
//                 <input
//                   type="password"
//                   id="password"
//                   className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300"
//                   placeholder="Enter your password"
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   required
//                 />
//               </div>
//             </div>
            
//             {/* MetaMask Integration for Doctor and Hospital */}
//             {(activeTab === 'doctor' || activeTab === 'hospital') && (
//               <div className="transition-all duration-300">
//                 <div className="flex items-center justify-between">
//                   <label className="block text-gray-700 font-medium mb-2">
//                     MetaMask Verification
//                   </label>
//                   <button
//                     type="button"
//                     onClick={connectMetaMask}
//                     className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors duration-300"
//                   >
//                     Connect Wallet
//                   </button>
//                 </div>
//                 {metaMaskId ? (
//                   <div className="p-3 bg-green-100 text-green-700 rounded-lg truncate transition-all duration-300 animate-fadeIn">
//                     <div className="flex items-center">
//                       <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
//                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
//                       </svg>
//                       <span className="text-sm">{metaMaskId.substring(0, 6)}...{metaMaskId.substring(metaMaskId.length - 4)}</span>
//                     </div>
//                   </div>
//                 ) : (
//                   <div className="p-3 bg-gray-100 text-gray-700 rounded-lg transition-all duration-300">
//                     <div className="flex items-center">
//                       <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
//                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
//                       </svg>
//                       <span className="text-sm">Please connect your MetaMask wallet</span>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             )}
            
//             <button
//               type="submit"
//               className={`w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 ${
//                 isLoading ? 'opacity-75 cursor-not-allowed' : ''
//               }`}
//               disabled={isLoading || ((activeTab === 'doctor' || activeTab === 'hospital') && !metaMaskId)}
//             >
//               {isLoading ? (
//                 <div className="flex items-center justify-center">
//                   <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
//                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//                   </svg>
//                   <span>Logging in...</span>
//                 </div>
//               ) : (
//                 'Sign In'
//               )}
//             </button>
//           </form>
          
//           <div className="mt-4 text-center">
//             <a href="#" className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors duration-300">
//               Forgot password?
//             </a>
//           </div>
          
//           <div className="mt-6 border-t border-gray-200 pt-4 text-center">
//             <p className="text-sm text-gray-600">
//               Need an account?{' '}
//               <a href="#" className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors duration-300">
//                 Register here
//               </a>
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default EnhancedLoginPage;

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [activeTab, setActiveTab] = useState('patient');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [metaMaskAddress, setMetaMaskAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusCode, setStatusCode] = useState(null);
  
  const navigate = useNavigate();

  const connectMetaMask = async () => {
    setError('');
    
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }
    
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setMetaMaskAddress(accounts[0]);
      return accounts[0];
    } catch (error) {
      setError('Failed to connect to MetaMask. Please try again.');
      console.error(error);
      return null;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    let endpoint = '';
    let requestBody = {};
    
    switch (activeTab) {
      case 'hospital':
        endpoint = 'http://localhost:8000/hospital-login/';
        
        // Verify MetaMask for hospital login
        const hospitalMetaMaskAccount = metaMaskAddress || await connectMetaMask();
        if (!hospitalMetaMaskAccount) {
          setIsLoading(false);
          return;
        }
        
        requestBody = {
          username,
          password,
          address: hospitalMetaMaskAccount
        };
        break;
        
      case 'doctor':
        endpoint = 'http://localhost:8000/doctor-login/';
        
        // Verify MetaMask for doctor login
        const doctorMetaMaskAccount = metaMaskAddress || await connectMetaMask();
        if (!doctorMetaMaskAccount) {
          setIsLoading(false);
          return;
        }
        
        requestBody = {
          username,
          password,
          address: doctorMetaMaskAccount
        };
        break;
        
      case 'patient':
        endpoint = 'http://localhost:8000/patient-login/';
        requestBody = {
          username,
          password
        };
        break;
        
      default:
        setError('Invalid login type');
        setIsLoading(false);
        return;
    }
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      setStatusCode(response.status);
      const data = await response.json();
      
      if (response.status === 200) {
        // Store token in localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('userType', activeTab);
        console.log('Token:', data.token);
        // Redirect based on user type
        navigate(`/${activeTab}-dashboard`);
      } else {
        // Handle different error responses
        if (data.error) {
          setError(data.error);
        } else if (data.some_error) {
          setError(JSON.stringify(data.some_error));
        } else {
          setError('Login failed. Please check your credentials.');
        }
      }
    } catch (error) {
      setError('Network error. Please try again later.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-6">Healthcare Login</h1>
        
        {/* Status Code Display */}
        {statusCode && (
          <div className={`mb-4 text-center p-2 rounded ${
            statusCode === 200 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            Status: {statusCode === 200 ? 'Success' : `Error (${statusCode})`}
          </div>
        )}
        
        {/* Login Type Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`flex-1 py-2 font-medium ${
              activeTab === 'patient' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-blue-500'
            }`}
            onClick={() => setActiveTab('patient')}
          >
            Patient
          </button>
          <button
            className={`flex-1 py-2 font-medium ${
              activeTab === 'doctor' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-blue-500'
            }`}
            onClick={() => setActiveTab('doctor')}
          >
            Doctor
          </button>
          <button
            className={`flex-1 py-2 font-medium ${
              activeTab === 'hospital' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:text-blue-500'
            }`}
            onClick={() => setActiveTab('hospital')}
          >
            Hospital
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-gray-700 font-medium mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          {/* MetaMask Integration for Doctor and Hospital */}
          {(activeTab === 'doctor' || activeTab === 'hospital') && (
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <label className="block text-gray-700 font-medium mb-2">
                  MetaMask Verification
                </label>
                <button
                  type="button"
                  onClick={connectMetaMask}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Connect Wallet
                </button>
              </div>
              {metaMaskAddress ? (
                <div className="p-3 bg-green-100 text-green-700 rounded-md truncate">
                  Connected: {metaMaskAddress}
                </div>
              ) : (
                <div className="p-3 bg-gray-100 text-gray-700 rounded-md">
                  Please connect your MetaMask wallet
                </div>
              )}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150"
            disabled={isLoading || ((activeTab === 'doctor' || activeTab === 'hospital') && !metaMaskAddress)}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <a href="#" className="text-sm text-blue-600 hover:text-blue-800">
            Forgot password?
          </a>
        </div>
        
        <div className="mt-6 border-t border-gray-200 pt-4 text-center">
          <p className="text-sm text-gray-600">
            Need an account?{' '}
            <a href="#" className="font-medium text-blue-600 hover:text-blue-800">
              Register here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;