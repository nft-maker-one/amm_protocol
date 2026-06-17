import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ethers } from 'ethers';
import toast, { Toaster } from 'react-hot-toast';

import NavBar from './components/ui/NavBar';

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

  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          
          if (accounts.length > 0) {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            setAccount(address);
            console.log("Auto-connected to:", address);
          }
        } catch (error) {
          console.error("Auto-connection check failed:", error);
        }
      }
    };

    checkConnection();

    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        toast.success("Account switched");
      } else {
        setAccount(null);
        toast("Wallet disconnected");
      }
    };

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }

    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setAccount(address);
        toast.success("Wallet connected successfully!");
      } catch (error) {
        console.error("Connection error:", error);
        toast.error("Connection rejected or an error occurred");
      }
    } else {
      toast.error("Please install MetaMask!");
    }
  };

  return (
    <Router>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      
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