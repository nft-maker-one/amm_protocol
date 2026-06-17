import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { 
  Coins, Flame, User, Wallet, AlertTriangle, 
  CheckCircle, XCircle
} from 'lucide-react';

import { getTokenList } from '../api/tokens';
import {
  ensureSepolia,
  getTokenBalance,
  getTokenInfo,
  mintToken,
  burnToken,
} from '../api/amm';
import ERC20ABI from '../api/abi/ERC20.json';
import TokenInputSelector from '../components/ui/TokenInputSelector';

const MockTokenPage = () => {
  const [tokenList, setTokenList] = useState(getTokenList());
  
  const [tokenChoice, setTokenChoice] = useState(tokenList[0]?.address || '');
  const [tokenCustom, setTokenCustom] = useState('');
  
  const [toAddr, setToAddr] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [burnAmount, setBurnAmount] = useState('');
  const [balance, setBalance] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [tokenOwner, setTokenOwner] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeTokenAddr = tokenChoice === 'custom' ? tokenCustom : tokenChoice;

  useEffect(() => {
    setTokenList(getTokenList());
  }, []);

  useEffect(() => {
    if (ethers.isAddress(activeTokenAddr)) {
      handleQueryBalance(false);
    }
  }, [activeTokenAddr]);

  const handleQueryBalance = async (showToast = true) => {
    if (!window.ethereum) return showToast && toast.error('Please connect wallet first');
    if (!ethers.isAddress(activeTokenAddr)) return showToast && toast.error('Invalid Token Address');
    
    let toastId;
    if (showToast) toastId = toast.loading('Syncing contract permissions...');

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const userAddr = await signer.getAddress();
      
      const bal = await getTokenBalance(provider, activeTokenAddr, userAddr);
      const info = await getTokenInfo(provider, activeTokenAddr);
      
      let owner = null;
      try {
        const token = new ethers.Contract(activeTokenAddr, ERC20ABI, provider);
        owner = await token.owner();
        setTokenOwner(owner);
        setIsOwner(owner.toLowerCase() === userAddr.toLowerCase());
      } catch (e) {
        setTokenOwner(null);
        setIsOwner(false);
      }
      
      setBalance(ethers.formatUnits(bal, info.decimals));
      setTokenInfo(info);
      if (showToast) toast.success('Synced successfully', { id: toastId });
    } catch (err) {
      if (showToast) toast.error('Query failed: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async () => {
    if (!toAddr || !mintAmount) return toast.error('Please provide recipient address and amount');
    const toastId = toast.loading('Initiating mint transaction...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const amountWei = ethers.parseUnits(mintAmount, tokenInfo.decimals);
      
      await mintToken(provider, signer, activeTokenAddr, toAddr, amountWei);
      toast.success(`Successfully minted ${mintAmount} ${tokenInfo.symbol}`, { id: toastId });
      setMintAmount('');
      handleQueryBalance(false);
    } catch (err) {
      toast.error('Mint failed: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleBurn = async () => {
    if (!burnAmount) return toast.error('Please enter amount to burn');
    const toastId = toast.loading('Initiating burn transaction...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const amountWei = ethers.parseUnits(burnAmount, tokenInfo.decimals);
      
      await burnToken(provider, signer, activeTokenAddr, amountWei);
      toast.success(`Successfully burned ${burnAmount} ${tokenInfo.symbol}`, { id: toastId });
      setBurnAmount('');
      handleQueryBalance(false);
    } catch (err) {
      toast.error('Burn failed: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{maxWidth: 800}}>
      <h2 style={{display:'flex', alignItems:'center', gap:10}}><Coins size={24} color="#FFD700"/> MockToken Management</h2>
      
      <div className="data-card" style={{borderLeft: '4px solid #646cff', marginBottom: '20px'}}>
        <TokenInputSelector 
          label="Target Token Contract"
          choice={tokenChoice}
          setChoice={setTokenChoice}
          customValue={tokenCustom}
          setCustomValue={setTokenCustom}
          tokenList={tokenList}
        />
        <button className="action-btn" onClick={() => handleQueryBalance(true)} disabled={loading}>
          {loading ? 'Querying...' : 'Sync Contract Details'}
        </button>
      </div>

      {tokenInfo && (
        <div className="data-card fade-in" style={{marginBottom: 20}}>
          <div style={{display: 'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <h3 style={{margin:0}}>{tokenInfo.name} ({tokenInfo.symbol})</h3>
              <div style={{fontSize:'0.85rem', color:'#888', marginTop:5}}>
                Balance: <span style={{color:'#646cff', fontWeight:'bold'}}>{parseFloat(balance).toLocaleString()}</span>
              </div>
            </div>
            <div style={{textAlign:'right', fontSize:'0.85rem', color:'#aaa'}}>
              <div>Permission Status: {isOwner ? <span style={{color:'#4ade80'}}>Owner</span> : <span style={{color:'#ef4444'}}>No Access</span>}</div>
              <div style={{fontSize:'0.7rem', opacity:0.6}}>{activeTokenAddr.slice(0,12)}...</div>
            </div>
          </div>
          
          <div style={{
            marginTop: 15, padding: 10, borderRadius: 8, 
            background: isOwner ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem'
          }}>
            {isOwner ? <CheckCircle size={16} color="#4ade80"/> : <XCircle size={16} color="#ef4444"/>}
            <span style={{color: isOwner ? '#4ade80' : '#ef4444'}}>
              {isOwner ? 'You are authorized to mint tokens.' : 'You are not the owner, minting will fail.'}
            </span>
          </div>
        </div>
      )}

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
        <div className="data-card" style={{opacity: isOwner ? 1 : 0.6, border: isOwner ? '1px solid #4ade80' : '1px solid #333'}}>
          <h4 style={{display:'flex', alignItems:'center', gap:8, color:'#4ade80'}}><Wallet size={18}/> Mint</h4>
          <div className="input-group">
            <label>Recipient Address</label>
            <div style={{display:'flex', gap:5}}>
              <input value={toAddr} onChange={e => setToAddr(e.target.value)} placeholder="0x..." />
              <button onClick={() => setToAddr(window.ethereum?.selectedAddress || '')} style={{padding:'0 10px'}}><User size={14}/></button>
            </div>
          </div>
          <div className="input-group">
            <label>Mint Amount</label>
            <input type="number" value={mintAmount} onChange={e => setMintAmount(e.target.value)} placeholder="0.0" />
          </div>
          <button className="action-btn" onClick={handleMint} disabled={loading || !isOwner} style={{background: isOwner ? '#2e7d32' : '#333'}}>
            Confirm Mint
          </button>
        </div>

        <div className="data-card" style={{border: '1px solid #e63946'}}>
          <h4 style={{display:'flex', alignItems:'center', gap:8, color:'#e63946'}}><Flame size={18}/> Burn</h4>
          <div className="input-group">
            <label>Burn Amount</label>
            <input type="number" value={burnAmount} onChange={e => setBurnAmount(e.target.value)} placeholder="0.0" />
          </div>
          <p style={{fontSize:'0.75rem', color:'#888', marginBottom:15}}>* Burning permanently reduces total supply</p>
          <button className="action-btn" onClick={handleBurn} disabled={loading || !tokenInfo} style={{background: '#b91c1c'}}>
            Confirm Burn
          </button>
        </div>
      </div>

      {!isOwner && tokenOwner && (
        <div style={{marginTop: 20, padding: 12, background: '#2a1810', border: '1px solid #f59e0b', borderRadius: 8, fontSize: '0.85rem', color: '#f59e0b', display:'flex', gap: 10}}>
          <AlertTriangle size={18} />
          <div>Token is controlled by {tokenOwner.slice(0,8)}... If you need minting permissions, please deploy your own token.</div>
        </div>
      )}
    </div>
  );
};

export default MockTokenPage;