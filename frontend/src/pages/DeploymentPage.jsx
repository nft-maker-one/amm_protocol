import React, { useState } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { 
  Layers, PlusCircle, PlayCircle, Code, 
  Terminal, Info, Eye, Trash2 
} from 'lucide-react';

import { getPoolList, updatePoolInList, addPoolToList } from '../api/pools';
import PoolSelector from '../components/ui/PoolSelector';
import TokenInputSelector from '../components/ui/TokenInputSelector';
import PoolInfoCard from '../components/ui/PoolInfoCard';
import { findTokenByAddress, addCustomToken, getTokenList, removeCustomToken } from '../api/tokens';
import {
  ensureSepolia, deployFactory, deployToken, initializePool,
  calculateSqrtPriceX96, getPool, createPool
} from '../api/amm';
import { FACTORY_BYTECODE, TOKEN_BYTECODE } from '../api/bytecodes';

const DeploymentPage = () => {
  const [activeTab, setActiveTab] = useState('factory');
  const [loading, setLoading] = useState(false);
  const [selectedPool, setSelectedPoolState] = useState(null);
  const [tokenList, setTokenList] = useState(getTokenList());
  const [poolList, setPoolList] = useState(getPoolList());

  // Factory State
  const [factoryAddresses, setFactoryAddresses] = useState([]);

  // Form states
  const [createTokenAChoice, setCreateTokenAChoice] = useState('');
  const [createTokenBChoice, setCreateTokenBChoice] = useState('');
  const [createTokenACustom, setCreateTokenACustom] = useState('');
  const [createTokenBCustom, setCreateTokenBCustom] = useState('');
  const [createFee, setCreateFee] = useState('3000');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [poolPrice, setPoolPrice] = useState('1'); 
  const [poolSqrtPriceX96, setPoolSqrtPriceX96] = useState('79228162514264337593543950336');

  // --- 0. 恢复功能：部署 Factory ---
  const handleDeployFactory = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    const toastId = toast.loading('正在部署 Factory...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const result = await deployFactory(provider, signer, FACTORY_BYTECODE);
      setFactoryAddresses(prev => [...prev, result.address]);
      
      toast.success(
        <div>
          <b>Factory 部署成功!</b><br/>
          <span style={{fontSize:'0.8rem'}}>{result.address.slice(0,10)}...</span>
        </div>, 
        { id: toastId }
      );
    } catch (err) {
      toast.error('部署失败: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // 1. 部署 Token 逻辑
  const handleDeployToken = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!tokenName || !tokenSymbol) return toast.error('请填写 Token 名称和符号');
    const toastId = toast.loading('正在部署 Token...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const result = await deployToken(provider, signer, TOKEN_BYTECODE, tokenName, tokenSymbol, 18, '1000000');
      addCustomToken({ symbol: tokenSymbol, address: result.address, decimalsHint: 18, isCustom: true });
      setTokenList(getTokenList());
      toast.success('Token 部署成功！', { id: toastId });
      setTokenName(''); setTokenSymbol('');
    } catch (err) {
      toast.error('部署失败: ' + err.message, { id: toastId });
    } finally { setLoading(false); }
  };

  // 2. 创建 Pool 逻辑
  const handleCreatePool = async () => {
    const tA = createTokenAChoice === 'custom' ? createTokenACustom : createTokenAChoice;
    const tB = createTokenBChoice === 'custom' ? createTokenBCustom : createTokenBChoice;
    if (!ethers.isAddress(tA) || !ethers.isAddress(tB)) return toast.error('无效地址');
    const toastId = toast.loading('正在创建交易对...');
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
      setPoolList(getPoolList());
      setSelectedPoolState(poolObj);
      toast.success('创建成功，去初始化吧！', { id: toastId });
      setTimeout(() => setActiveTab('pool'), 1000);
    } catch (err) {
      toast.error('创建失败: ' + err.message, { id: toastId });
    } finally { setLoading(false); }
  };

  // 3. 初始化逻辑
  const handleInitializePool = async () => {
    if (!selectedPool) return toast.error('请选择池子');
    const toastId = toast.loading('初始化中...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      await initializePool(provider, signer, selectedPool.address, BigInt(poolSqrtPriceX96));
      updatePoolInList(selectedPool.address, { isInitialized: true, sqrtPriceX96: poolSqrtPriceX96 });
      setPoolList(getPoolList());
      toast.success('初始化成功！', { id: toastId });
    } catch (err) {
      toast.error('失败: ' + err.message, { id: toastId });
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
      <h2 style={{display:'flex', alignItems:'center', gap:10}}>🚀 部署中心</h2>
      <div style={{display: 'flex', gap: '10px', marginBottom: '25px', background: '#1a1a1a', padding: 5, borderRadius: 10}}>
        <TabButton id="factory" label="Factory" icon={Layers} />
        <TabButton id="token" label="Token" icon={Code} />
        <TabButton id="create-pool" label="Create Pool" icon={PlusCircle} />
        <TabButton id="pool" label="Initialize Pool" icon={PlayCircle} />
      </div>

      {activeTab === 'factory' && (
        <div className="fade-in">
          {/* Factory 部署历史 */}
          {factoryAddresses.length > 0 && (
            <div className="data-card" style={{borderLeft: '4px solid #4ade80', marginBottom: 20}}>
              <h4>已部署的 Factory</h4>
              {factoryAddresses.map((addr, idx) => (
                <div key={idx} style={{fontFamily:'monospace', fontSize:'0.9rem', color:'#4ade80', padding:'5px 0', borderBottom:'1px solid #333'}}>
                  #{idx+1}: {addr}
                </div>
              ))}
            </div>
          )}

          <div className="data-card" style={{borderLeft:'4px solid #f59e0b'}}>
            <h4><Terminal size={16}/> Factory 配置</h4>
            <p style={{fontSize:'0.8rem', color:'#aaa'}}>Factory 是整个 AMM 的核心，通常只需要部署一次。</p>
            <textarea value={FACTORY_BYTECODE} disabled style={{width:'100%', minHeight:100, background:'#111', color:'#555', marginBottom:15}} />
            <button className="action-btn" onClick={handleDeployFactory} disabled={loading} style={{background: '#f59e0b'}}>
              {loading ? '部署中...' : '部署新的 Factory 合约'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'token' && (
        <div className="fade-in">
          <div className="data-card" style={{marginBottom:15}}>
            <h4>部署新 Token</h4>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
              <input placeholder="Name" value={tokenName} onChange={e=>setTokenName(e.target.value)} />
              <input placeholder="Symbol" value={tokenSymbol} onChange={e=>setTokenSymbol(e.target.value)} />
            </div>
            <button className="action-btn" onClick={handleDeployToken} disabled={loading}>部署</button>
          </div>
          <div className="data-card">
            <h4>已有 Token</h4>
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
          <input type="number" value={createFee} onChange={e=>setCreateFee(e.target.value)} style={{width:'100%', marginBottom:15}} placeholder="Fee (3000)" />
          <button className="action-btn" onClick={handleCreatePool} disabled={loading}>创建池子</button>
        </div>
      )}

      {activeTab === 'pool' && (
        <div className="fade-in">
          <PoolSelector selectedPool={selectedPool} onPoolSelect={setSelectedPoolState} />
          {selectedPool && <PoolInfoCard pool={selectedPool} isActive={true} showDetails={true} />}
          <div style={{marginTop:15}}>
            <input type="number" value={poolPrice} onChange={e=>setPoolPrice(e.target.value)} style={{width:'100%', marginBottom:10}} />
            <button className="action-btn" onClick={handleInitializePool} disabled={loading}>完成初始化</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentPage;