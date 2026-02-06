import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { 
  Coins, Flame, Search, User, Wallet, AlertTriangle, 
  CheckCircle, XCircle, Copy 
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
  
  // 使用统一的 Selector 状态
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

  // 计算当前实际操作的代币地址
  const activeTokenAddr = tokenChoice === 'custom' ? tokenCustom : tokenChoice;

  // 列表同步逻辑
  useEffect(() => {
    setTokenList(getTokenList());
  }, []);

  // 自动查询逻辑：当地址改变且合法时自动触发
  useEffect(() => {
    if (ethers.isAddress(activeTokenAddr)) {
      handleQueryBalance(false); // 静默查询
    }
  }, [activeTokenAddr]);

  const handleQueryBalance = async (showToast = true) => {
    if (!window.ethereum) return showToast && toast.error('请先连接钱包');
    if (!ethers.isAddress(activeTokenAddr)) return showToast && toast.error('无效的 Token 地址');
    
    let toastId;
    if (showToast) toastId = toast.loading('正在同步合约权限...');

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
      if (showToast) toast.success('同步成功', { id: toastId });
    } catch (err) {
      if (showToast) toast.error('查询失败: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async () => {
    if (!toAddr || !mintAmount) return toast.error('请填写接收地址和数量');
    const toastId = toast.loading('正在发起铸造交易...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const amountWei = ethers.parseUnits(mintAmount, tokenInfo.decimals);
      
      await mintToken(provider, signer, activeTokenAddr, toAddr, amountWei);
      toast.success(`成功铸造 ${mintAmount} ${tokenInfo.symbol}`, { id: toastId });
      setMintAmount('');
      handleQueryBalance(false);
    } catch (err) {
      toast.error('铸造失败: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleBurn = async () => {
    if (!burnAmount) return toast.error('请输入销毁数量');
    const toastId = toast.loading('正在发起销毁交易...');
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const amountWei = ethers.parseUnits(burnAmount, tokenInfo.decimals);
      
      await burnToken(provider, signer, activeTokenAddr, amountWei);
      toast.success(`成功销毁 ${burnAmount} ${tokenInfo.symbol}`, { id: toastId });
      setBurnAmount('');
      handleQueryBalance(false);
    } catch (err) {
      toast.error('销毁失败: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{maxWidth: 800}}>
      <h2 style={{display:'flex', alignItems:'center', gap:10}}><Coins size={24} color="#FFD700"/> MockToken 管理</h2>
      
      {/* 统一的 Token 选择器 */}
      <div className="data-card" style={{borderLeft: '4px solid #646cff', marginBottom: '20px'}}>
        <TokenInputSelector 
          label="目标代币合约"
          choice={tokenChoice}
          setChoice={setTokenChoice}
          customValue={tokenCustom}
          setCustomValue={setTokenCustom}
          tokenList={tokenList}
        />
        <button className="action-btn" onClick={() => handleQueryBalance(true)} disabled={loading}>
          {loading ? '查询中...' : '同步合约详情'}
        </button>
      </div>

      {tokenInfo && (
        <div className="data-card fade-in" style={{marginBottom: 20}}>
          <div style={{display: 'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <h3 style={{margin:0}}>{tokenInfo.name} ({tokenInfo.symbol})</h3>
              <div style={{fontSize:'0.85rem', color:'#888', marginTop:5}}>
                余额: <span style={{color:'#646cff', fontWeight:'bold'}}>{parseFloat(balance).toLocaleString()}</span>
              </div>
            </div>
            <div style={{textAlign:'right', fontSize:'0.85rem', color:'#aaa'}}>
              <div>权限状态: {isOwner ? <span style={{color:'#4ade80'}}>Owner</span> : <span style={{color:'#ef4444'}}>No Access</span>}</div>
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
              {isOwner ? '您可以进行铸造操作' : '您不是该代币的 Owner，铸造操作将会失败'}
            </span>
          </div>
        </div>
      )}

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
        {/* Mint Section */}
        <div className="data-card" style={{opacity: isOwner ? 1 : 0.6, border: isOwner ? '1px solid #4ade80' : '1px solid #333'}}>
          <h4 style={{display:'flex', alignItems:'center', gap:8, color:'#4ade80'}}><Wallet size={18}/> 铸造 (Mint)</h4>
          <div className="input-group">
            <label>接收者地址</label>
            <div style={{display:'flex', gap:5}}>
              <input value={toAddr} onChange={e => setToAddr(e.target.value)} placeholder="0x..." />
              <button onClick={() => setToAddr(window.ethereum?.selectedAddress || '')} style={{padding:'0 10px'}}><User size={14}/></button>
            </div>
          </div>
          <div className="input-group">
            <label>铸造数量</label>
            <input type="number" value={mintAmount} onChange={e => setMintAmount(e.target.value)} placeholder="0.0" />
          </div>
          <button className="action-btn" onClick={handleMint} disabled={loading || !isOwner} style={{background: isOwner ? '#2e7d32' : '#333'}}>
            确认铸造
          </button>
        </div>

        {/* Burn Section */}
        <div className="data-card" style={{border: '1px solid #e63946'}}>
          <h4 style={{display:'flex', alignItems:'center', gap:8, color:'#e63946'}}><Flame size={18}/> 销毁 (Burn)</h4>
          <div className="input-group">
            <label>销毁数量</label>
            <input type="number" value={burnAmount} onChange={e => setBurnAmount(e.target.value)} placeholder="0.0" />
          </div>
          <p style={{fontSize:'0.75rem', color:'#888', marginBottom:15}}>* 销毁将永久减少总供应量</p>
          <button className="action-btn" onClick={handleBurn} disabled={loading || !tokenInfo} style={{background: '#b91c1c'}}>
            确认销毁
          </button>
        </div>
      </div>

      {!isOwner && tokenOwner && (
        <div style={{marginTop: 20, padding: 12, background: '#2a1810', border: '1px solid #f59e0b', borderRadius: 8, fontSize: '0.85rem', color: '#f59e0b', display:'flex', gap: 10}}>
          <AlertTriangle size={18} />
          <div>该代币由地址 {tokenOwner.slice(0,8)}... 控制。如果您需要铸造权限，请在部署页发布自己的代币。</div>
        </div>
      )}
    </div>
  );
};

export default MockTokenPage;