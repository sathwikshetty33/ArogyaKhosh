import React from 'react';
import { Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage'; // Import LoginPage component

// Your App component where routing is defined
function App() {
  return (
    <Routes>
      {/* Define routes for your application */}
      <Route path="/" element={<LoginPage />} />
      {/* You can add more routes here, such as the dashboard pages */}
    </Routes>
  );
}

export default App;
