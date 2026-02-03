// src/App.jsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ethers } from 'ethers';

// Import UI components
import { NavBar } from './components';

// Import page components  
import {
  SwapPage,
  LiquidityPage,
  AdvancedTradePage,
  AnalyticsPage,
  MockTokenPage,
  DeploymentPage
} from './pages';

function App() {
  const [account, setAccount] = useState(null);

  // 连接 MetaMask 的逻辑
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        setAccount(await signer.getAddress());
      } catch (error) {
        console.error("User rejected connection", error);
      }
    } else {
      alert("请安装 MetaMask!");
    }
  };

  return (
    <Router>
      <NavBar account={account} connectWallet={connectWallet} />
      <Routes>
        <Route path="/" element={<SwapPage />} />
        <Route path="/liquidity" element={<LiquidityPage />} />
        <Route path="/trade" element={<AdvancedTradePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/token" element={<MockTokenPage />} />
        <Route path="/deploy" element={<DeploymentPage />} />
      </Routes>
    </Router>
  );
}

export default App;