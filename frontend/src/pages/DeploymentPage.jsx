import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { 
  Layers, PlusCircle, PlayCircle, Code, 
  Terminal, Trash2, RefreshCw
} from 'lucide-react';

import { getFilteredPoolList, updatePoolInList, addPoolToList, syncPoolsFromBlockchain } from '../api/pools';
import PoolSelector from '../components/ui/PoolSelector';
import TokenInputSelector from '../components/ui/TokenInputSelector';
import PoolInfoCard from '../components/ui/PoolInfoCard';
import { findTokenByAddress, addCustomToken, getTokenList, removeCustomToken } from '../api/tokens';
import {
  ensureSepolia, deployFactory, deployToken, initializePool,
  getPool, createPool
} from '../api/amm';
import { FACTORY_BYTECODE, TOKEN_BYTECODE } from '../api/bytecodes';

const DeploymentPage = () => {
  const [activeTab, setActiveTab] = useState('factory');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedPool, setSelectedPoolState] = useState(null);
  const [tokenList, setTokenList] = useState(getTokenList());
  const [poolList, setPoolList] = useState(getFilteredPoolList());

  const [factoryAddresses, setFactoryAddresses] = useState([]);

  const [createTokenAChoice, setCreateTokenAChoice] = useState('');
  const [createTokenBChoice, setCreateTokenBChoice] = useState('');
  const [createTokenACustom, setCreateTokenACustom] = useState('');
  const [createTokenBCustom, setCreateTokenBCustom] = useState('');
  const [createFee, setCreateFee] = useState('3000');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [poolPrice, setPoolPrice] = useState('1'); 
  const [poolSqrtPriceX96, setPoolSqrtPriceX96] = useState('79228162514264337593543950336');

  // Auto-sync pools from blockchain on mount
  useEffect(() => {
    const syncPools = async () => {
      if (!window.ethereum) return;
      
      try {
        setSyncing(true);
        const provider = new ethers.BrowserProvider(window.ethereum);
        await syncPoolsFromBlockchain(provider, false); // Use cache if available
        setPoolList(getFilteredPoolList());
      } catch (err) {
        console.error('Failed to sync pools:', err);
      } finally {
        setSyncing(false);
      }
    };
    
    syncPools();
  }, []);

  const handleRefreshPools = async () => {
    if (!window.ethereum) return toast.error('Please connect wallet first');
    
    const toastId = toast.loading('Syncing pools from blockchain...');
    try {
      setSyncing(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await syncPoolsFromBlockchain(provider, true); // Force refresh
      setPoolList(getFilteredPoolList());
      toast.success('Pools synced successfully!', { id: toastId });
    } catch (err) {
      toast.error('Failed to sync pools: ' + err.message, { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  const handleDeployFactory = async () => {
    if (!window.ethereum) return toast.error('Please connect wallet first');
    const toastId = toast.loading('Deploying Factory...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const result = await deployFactory(provider, signer, FACTORY_BYTECODE);
      setFactoryAddresses(prev => [...prev, result.address]);
      
      toast.success(
        <div>
          <b>Factory Deployed Successfully!</b><br/>
          <span style={{fontSize:'0.8rem'}}>{result.address.slice(0,10)}...</span>
        </div>, 
        { id: toastId }
      );
    } catch (err) {
      toast.error('Deployment failed: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleDeployToken = async () => {
    if (!window.ethereum) return toast.error('Please connect wallet first');
    if (!tokenName || !tokenSymbol) return toast.error('Please enter Token name and symbol');
    const toastId = toast.loading('Deploying Token...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const result = await deployToken(provider, signer, TOKEN_BYTECODE, tokenName, tokenSymbol, 18, '1000000');
      
      addCustomToken({ symbol: tokenSymbol, address: result.address, decimalsHint: 18, isCustom: true });
      setTokenList(getTokenList());
      toast.success(
        <div>
          <b>Token deployed successfully!</b><br/>
          <span style={{fontSize:'0.8rem', fontFamily:'monospace'}}>{result.address}</span><br/>
          <span style={{fontSize:'0.75rem', color:'#aaa'}}>Please verify the contract on Sepolia Etherscan</span>
        </div>, 
        { id: toastId }
      );
      setTokenName(''); 
      setTokenSymbol('');
    } catch (err) {
      let errorMsg = err.message;
      
      // Provide more detailed error messages
      if (errorMsg.includes('bytecode')) {
        errorMsg = 'TOKEN_BYTECODE not configured or invalid. Please check if VITE_TOKEN_BYTECODE exists and is correct in .env.local';
      } else if (errorMsg.includes('insufficient funds')) {
        errorMsg = 'Sepolia testnet ETH insufficient. Get test ETH from faucet: https://sepoliafaucet.com';
      } else if (errorMsg.includes('transaction failed')) {
        errorMsg = 'Transaction execution failed. May be due to network congestion or invalid bytecode';
      }
      
      toast.error(
        <div>
          <b>Deployment failed</b><br/>
          <span style={{fontSize:'0.8rem'}}>{errorMsg}</span>
        </div>, 
        { id: toastId, duration: 5000 }
      );
    } finally { 
      setLoading(false); 
    }
  };

  const handleCreatePool = async () => {
    const tA = createTokenAChoice === 'custom' ? createTokenACustom : createTokenAChoice;
    const tB = createTokenBChoice === 'custom' ? createTokenBCustom : createTokenBChoice;
    if (!ethers.isAddress(tA) || !ethers.isAddress(tB)) return toast.error('Invalid address');
    const toastId = toast.loading('Creating trading pair...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      await createPool(provider, signer, tA, tB, Number(createFee));
      const addr = await getPool(provider, tA, tB, Number(createFee));
      const poolObj = {
        address: addr,
        token0: tA.toLowerCase() < tB.toLowerCase() ? tA : tB,
        token1: tA.toLowerCase() < tB.toLowerCase() ? tB : tA,
        token0Meta: findTokenByAddress(tA.toLowerCase() < tB.toLowerCase() ? tA : tB),
        token1Meta: findTokenByAddress(tA.toLowerCase() < tB.toLowerCase() ? tB : tA),
        fee: createFee, isInitialized: false
      };
      addPoolToList(poolObj);
      setPoolList(getFilteredPoolList());
      setSelectedPoolState(poolObj);
      toast.success('Created successfully, please initialize!', { id: toastId });
      setTimeout(() => setActiveTab('pool'), 1000);
    } catch (err) {
      toast.error('Creation failed: ' + err.message, { id: toastId });
    } finally { setLoading(false); }
  };

  const handleInitializePool = async () => {
    if (!selectedPool) return toast.error('Please select a pool');
    const toastId = toast.loading('Initializing...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      await initializePool(provider, signer, selectedPool.address, BigInt(poolSqrtPriceX96));
      updatePoolInList(selectedPool.address, { isInitialized: true, sqrtPriceX96: poolSqrtPriceX96 });
      setPoolList(getFilteredPoolList());
      toast.success('Pool initialization successful!', { id: toastId });
    } catch (err) {
      toast.error('Failed: ' + err.message, { id: toastId });
    } finally { setLoading(false); }
  };

  const TabButton = ({ id, label, icon: Icon }) => (
    <button onClick={() => setActiveTab(id)} style={{
      flex: 1, padding: '12px', background: activeTab === id ? '#646cff' : '#333', color: '#fff',
      border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      {Icon && <Icon size={16} />} {label}
    </button>
  );

  return (
    <div className="container">
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap: 'nowrap'}}>
        <h2 style={{display:'flex', alignItems:'center', gap:10, margin:0, whiteSpace: 'nowrap'}}>Deployment Center</h2>
        <button 
          onClick={handleRefreshPools} 
          disabled={syncing}
          style={{
            padding: '12px',
            background: syncing ? '#555' : '#646cff',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: syncing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            whiteSpace: 'nowrap'
          }}
        >
          <RefreshCw size={16} style={{animation: syncing ? 'spin 1s linear infinite' : 'none'}} />
          {syncing ? 'Syncing...' : 'Refresh'}
        </button>
      </div>
      
      {syncing && (
        <div style={{
          padding: '12px',
          background: '#1a3a52',
          border: '1px solid #2563eb',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '0.9rem',
          color: '#60a5fa'
        }}>
          🔄 Fetching pools from blockchain... This ensures all environments (Vercel/localhost) see the same data.
        </div>
      )}
      
      <div style={{display: 'flex', gap: '10px', marginBottom: '25px', background: '#1a1a1a', padding: 5, borderRadius: 10}}>
        <TabButton id="factory" label="Factory" icon={Layers} />
        <TabButton id="token" label="Token" icon={Code} />
        <TabButton id="create-pool" label="Create Pool" icon={PlusCircle} />
        <TabButton id="pool" label="Initialize Pool" icon={PlayCircle} />
      </div>

      {activeTab === 'factory' && (
        <div className="fade-in">
          {factoryAddresses.length > 0 && (
            <div className="data-card" style={{borderLeft: '4px solid #4ade80', marginBottom: 20}}>
              <h4>Deployed Factories</h4>
              {factoryAddresses.map((addr, idx) => (
                <div key={idx} style={{fontFamily:'monospace', fontSize:'0.9rem', color:'#4ade80', padding:'5px 0', borderBottom:'1px solid #333'}}>
                  #{idx+1}: {addr}
                </div>
              ))}
            </div>
          )}

          <div className="data-card" style={{borderLeft:'4px solid #f59e0b'}}>
            <h4><Terminal size={16}/> Factory Configuration</h4>
            <p style={{fontSize:'0.8rem', color:'#aaa'}}>Factory is the core of the AMM, usually deployed once.</p>
            <textarea value={FACTORY_BYTECODE} disabled style={{width:'100%', minHeight:100, background:'#111', color:'#555', marginBottom:15}} />
            <button className="action-btn" onClick={handleDeployFactory} disabled={loading} style={{background: '#f59e0b'}}>
              {loading ? 'Deploying...' : 'Deploy New Factory Contract'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'token' && (
        <div className="fade-in">
          <div className="data-card" style={{marginBottom:15}}>
            <h4>Deploy New Token</h4>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
              <input placeholder="Name" value={tokenName} onChange={e=>setTokenName(e.target.value)} />
              <input placeholder="Symbol" value={tokenSymbol} onChange={e=>setTokenSymbol(e.target.value)} />
            </div>
            <button className="action-btn" onClick={handleDeployToken} disabled={loading}>Deploy</button>
          </div>
          <div className="data-card">
            <h4>Existing Tokens</h4>
            {tokenList.map(t => (
              <div key={t.address} style={{fontSize:'0.8rem', padding:5, borderBottom:'1px solid #333', display:'flex', justifyContent:'space-between'}}>
                <span>{t.symbol} - {t.address.slice(0,10)}...</span>
                {t.isCustom && <Trash2 size={14} onClick={() => {removeCustomToken(t.address); setTokenList(getTokenList());}} style={{cursor:'pointer', color:'#ef4444'}} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'create-pool' && (
        <div className="fade-in">
          <TokenInputSelector label="Token A" choice={createTokenAChoice} setChoice={setCreateTokenAChoice} customValue={createTokenACustom} setCustomValue={setCreateTokenACustom} tokenList={tokenList} />
          <TokenInputSelector label="Token B" choice={createTokenBChoice} setChoice={setCreateTokenBChoice} customValue={createTokenBCustom} setCustomValue={setCreateTokenBCustom} tokenList={tokenList} />
          <div style={{marginBottom:15}}>
            <label style={{display:'block', fontSize:'0.9rem', marginBottom:5, color:'#aaa'}}>Fee Tier</label>
            <select value={createFee} onChange={e=>setCreateFee(e.target.value)} style={{width:'100%', padding:'8px', background:'#222', color:'#fff', border:'1px solid #444', borderRadius:'4px'}}>
              <option value="500">500 (0.05%)</option>
              <option value="3000">3000 (0.3%) - Recommended</option>
              <option value="10000">10000 (1%)</option>
            </select>
          </div>
          <button className="action-btn" onClick={handleCreatePool} disabled={loading}>Create Pool</button>
        </div>
      )}

      {activeTab === 'pool' && (
        <div className="fade-in">
          <PoolSelector selectedPool={selectedPool} onPoolSelect={setSelectedPoolState} />
          {selectedPool && <PoolInfoCard pool={selectedPool} isActive={true} showDetails={true} />}
          <div style={{marginTop:15}}>
            <label style={{display:'block', fontSize:'0.9rem', marginBottom:5, color:'#aaa'}}>Initial Price</label>
            <input 
              type="number" 
              placeholder="e.g., 1.0 for 1:1 ratio, 2.0 for 2:1 ratio" 
              value={poolPrice} 
              onChange={e=>setPoolPrice(e.target.value)} 
              style={{width:'100%', padding:'8px', background:'#222', color:'#fff', border:'1px solid #444', borderRadius:'4px', marginBottom:10}} 
            />
            <button className="action-btn" onClick={handleInitializePool} disabled={loading}>Complete Initialization</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentPage;