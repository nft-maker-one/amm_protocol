// src/App.jsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ethers } from 'ethers';
// 1. 加回这行：引入 Toast 库
import toast, { Toaster } from 'react-hot-toast';

import { NavBar } from './components';
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

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        setAccount(await signer.getAddress());
        // 2. 加回这行：连接成功提示
        toast.success("钱包连接成功！");
      } catch (error) {
        console.error("User rejected connection", error);
        toast.error("连接被拒绝");
      }
    } else {
      toast.error("请安装 MetaMask!");
    }
  };

  return (
    <Router>
      {/* 3. 加回这行：Toast 的全局显示位 */}
      <Toaster position="top-center" />
      
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