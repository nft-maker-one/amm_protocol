import React, { useState } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast'; // 1. 引入 Toast
import { X, Info, AlertTriangle } from 'lucide-react'; // 2. 引入图标

import { findTokenByAddress } from '../api/tokens';
// 注意：如果 api/pools.js 没有导出 getPoolList 等，请像 SwapPage 那样做个本地 mock 或删除引用
import { getPoolList, getSelectedPool, setSelectedPool } from '../api/pools';
import PoolSelector from '../components/ui/PoolSelector';
import {
  AMMPOOL_ADDRESS,
  ensureSepolia,
  getPoolContract,
  quoteMint,
  addLiquidity,
  removeLiquidity,
  collectFees,
  quoteBurn,
  getPosition,
} from '../api/amm';

// --- 通用 Modal 组件 ---
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

const LiquidityPage = () => {
  const [mode, setMode] = useState('add'); // 'add', 'remove', 'collect'
  const [selectedPool, setSelectedPool] = useState(null);
  const [poolAddr, setPoolAddr] = useState(AMMPOOL_ADDRESS);
  const [tickLower, setTickLower] = useState('-60');
  const [tickUpper, setTickUpper] = useState('60');
  const [liqAmount, setLiqAmount] = useState('1000');
  
  const [quote, setQuote] = useState(null); // { amount0, amount1, token0, token1 }
  const [burnQuote, setBurnQuote] = useState(null); 
  const [position, setPosition] = useState(null); 
  const [busy, setBusy] = useState(false);

  // --- 新增：确认弹窗状态 ---
  const [isAddConfirmOpen, setIsAddConfirmOpen] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

  // 当选择池子时更新池子地址
  const handlePoolSelect = (pool) => {
    setSelectedPool(pool);
    if (pool) {
      setPoolAddr(pool.address);
      // 如果有需要，也可以在这里重置 quote 等状态
      setQuote(null);
      setBurnQuote(null);
    }
  };

  // --- 1. 报价逻辑 (Mint Quote) ---
  const handleQuote = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!ethers.isAddress(poolAddr)) return toast.error('Pool 地址无效');
    if (!tickLower || !tickUpper) return toast.error('请输入 tickLower / tickUpper');
    
    const toastId = toast.loading('正在计算所需代币...');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const recipient = await signer.getAddress();
      const pool = getPoolContract(provider, poolAddr);
      const [t0, t1] = await Promise.all([pool.token0(), pool.token1()]);

      const q = await quoteMint(
        provider,
        poolAddr,
        recipient,
        Number(tickLower),
        Number(tickUpper),
        BigInt(liqAmount)
      );
      
      const t0Meta = findTokenByAddress(t0);
      const t1Meta = findTokenByAddress(t1);

      // 保存更多元数据以便显示
      setQuote({ 
        ...q, 
        token0: t0, 
        token1: t1,
        token0Symbol: t0Meta?.symbol || 'Token0',
        token1Symbol: t1Meta?.symbol || 'Token1'
      });

      toast.success('报价成功', { id: toastId });
    } catch (err) {
      toast.error('报价失败: ' + (err.message || err), { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  // --- 2. 添加流动性逻辑 (分为 Check 和 Execute) ---
  const handleAddLiquidityCheck = () => {
     if (!quote) return toast.error("请先点击'报价'以确认数量");
     if (!poolAddr) return toast.error("无效的池子地址");
     setIsAddConfirmOpen(true); // 打开确认框
  };

  const executeAddLiquidity = async () => {
    setIsAddConfirmOpen(false); // 关闭弹窗
    if (!window.ethereum) return toast.error('请先连接钱包');

    const addPromise = (async () => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const res = await addLiquidity(
        provider,
        signer,
        poolAddr,
        Number(tickLower),
        Number(tickUpper),
        BigInt(liqAmount)
      );
      return res.tx.hash;
    })();

    toast.promise(addPromise, {
      loading: '正在添加流动性 (需 approve + mint)...',
      success: (hash) => `添加成功! Tx: ${hash.substring(0,8)}...`,
      error: (err) => `失败: ${err.message}`
    });
  };

  // --- 3. 移除报价逻辑 (Burn Quote) ---
  const handleQuoteBurn = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    const toastId = toast.loading('正在计算可提取金额...');
    
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      const pool = getPoolContract(provider, poolAddr);
      const [t0, t1] = await Promise.all([pool.token0(), pool.token1()]);
      
      const q = await quoteBurn(
        provider,
        poolAddr,
        Number(tickLower),
        Number(tickUpper),
        BigInt(liqAmount)
      );
      
      const t0Meta = findTokenByAddress(t0);
      const t1Meta = findTokenByAddress(t1);

      setBurnQuote({ 
          ...q, 
          token0: t0, 
          token1: t1,
          token0Symbol: t0Meta?.symbol || 'Token0',
          token1Symbol: t1Meta?.symbol || 'Token1'
      });
      
      toast.success('计算完成', { id: toastId });
    } catch (err) {
      toast.error('计算失败: ' + err.message, { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  // --- 4. 移除流动性逻辑 (分为 Check 和 Execute) ---
  const handleRemoveLiquidityCheck = () => {
      if (!burnQuote) return toast.error("请先点击'报价'预览结果");
      setIsRemoveConfirmOpen(true);
  };

  const executeRemoveLiquidity = async () => {
    setIsRemoveConfirmOpen(false);
    
    const removePromise = (async () => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const res = await removeLiquidity(
        provider,
        signer,
        poolAddr,
        Number(tickLower),
        Number(tickUpper),
        BigInt(liqAmount)
      );
      return res.tx.hash;
    })();

    toast.promise(removePromise, {
      loading: '正在移除流动性...',
      success: (hash) => {
          // 移除成功后，提醒用户去 Collect
          setTimeout(() => toast('别忘了点击"收集费用"提取代币哦！', { icon: '💡', duration: 5000 }), 2000);
          return `移除成功! Tx: ${hash.substring(0,8)}...`;
      },
      error: (err) => `失败: ${err.message}`
    });
  };

  // --- 5. 查询持仓 ---
  const handleGetPosition = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    const toastId = toast.loading('查询链上持仓...');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const owner = await signer.getAddress();
      
      const pos = await getPosition(
        provider,
        poolAddr,
        owner,
        Number(tickLower),
        Number(tickUpper)
      );
      
      setPosition(pos);
      toast.success('持仓更新成功', { id: toastId });
    } catch (err) {
      toast.error('查询失败: ' + err.message, { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  // --- 6. 收集费用 ---
  const handleCollectFees = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    
    const collectPromise = (async () => {
        setBusy(true);
        const provider = new ethers.BrowserProvider(window.ethereum);
        await ensureSepolia(provider);
        const signer = await provider.getSigner();
        const MaxUint128 = 2n ** 128n - 1n;
        
        const tx = await collectFees(
            provider,
            signer,
            poolAddr,
            Number(tickLower),
            Number(tickUpper),
            MaxUint128,
            MaxUint128
        );
        return tx.hash;
    })();

    toast.promise(collectPromise, {
        loading: '正在收集费用...',
        success: (hash) => {
            setBusy(false);
            return `收集成功! 资产已入账`;
        },
        error: (err) => {
            setBusy(false);
            return `收集失败: ${err.message}`;
        }
    });
  };

  return (
    <div className="container">
      <h2>💧 流动性管理</h2>

      {/* --- Modal 1: 添加流动性确认 --- */}
      <Modal isOpen={isAddConfirmOpen} onClose={() => setIsAddConfirmOpen(false)} title="确认添加流动性">
         {quote && (
             <div>
                 <div className="data-card" style={{marginTop:0}}>
                     <p style={{margin: '5px 0'}}>您将存入：</p>
                     <div style={{display:'flex', justifyContent:'space-between', fontSize: '1.1rem'}}>
                         <span>{quote.token0Symbol}</span>
                         <b>{quote.amount0.toString()}</b>
                     </div>
                     <div style={{display:'flex', justifyContent:'space-between', fontSize: '1.1rem', marginTop: 5}}>
                         <span>{quote.token1Symbol}</span>
                         <b>{quote.amount1.toString()}</b>
                     </div>
                 </div>
                 <div style={{fontSize: '0.85rem', color: '#aaa', margin: '15px 0'}}>
                     <p style={{display:'flex', alignItems:'center', gap: 5}}>
                        <Info size={14}/> 包含 approve 和 mint 两步操作
                     </p>
                     <p>Tick范围: {tickLower} ~ {tickUpper}</p>
                 </div>
                 <button className="action-btn" onClick={executeAddLiquidity}>确认存入</button>
             </div>
         )}
      </Modal>

      {/* --- Modal 2: 移除流动性确认 --- */}
      <Modal isOpen={isRemoveConfirmOpen} onClose={() => setIsRemoveConfirmOpen(false)} title="确认移除流动性">
         {burnQuote && (
             <div>
                 <p style={{color: '#e63946', fontWeight: 'bold'}}>⚠️ 您将销毁 {liqAmount} LP 凭证</p>
                 <div className="data-card">
                     <p style={{margin: '5px 0'}}>预计取回：</p>
                     <div style={{display:'flex', justifyContent:'space-between'}}>
                         <span>{burnQuote.token0Symbol}</span>
                         <b>{burnQuote.amount0.toString()}</b>
                     </div>
                     <div style={{display:'flex', justifyContent:'space-between', marginTop: 5}}>
                         <span>{burnQuote.token1Symbol}</span>
                         <b>{burnQuote.amount1.toString()}</b>
                     </div>
                 </div>
                 <p style={{fontSize: '0.85rem', color: '#aaa', marginTop: 10}}>
                     注意：操作成功后，代币不会直接进入钱包，而是会显示在"可收集数量"中，请务必执行最后一步"收集费用"。
                 </p>
                 <button className="action-btn" style={{backgroundColor: '#e63946'}} onClick={executeRemoveLiquidity}>
                     确认销毁并移除
                 </button>
             </div>
         )}
      </Modal>
      
      {/* 池子选择器 */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #333', borderRadius: '8px', background: '#1a1a1a' }}>
        <h3 style={{margin: '0 0 10px 0'}}>选择池子</h3>
        <PoolSelector 
          selectedPool={selectedPool} 
          onPoolSelect={handlePoolSelect}
        />
        {selectedPool && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(74, 222, 128, 0.1)', borderRadius: '5px', border: '1px solid rgba(74, 222, 128, 0.2)', fontSize: '0.9rem' }}>
            <div style={{color: '#4ade80'}}><b>已选:</b> {selectedPool.token0Meta?.symbol}/{selectedPool.token1Meta?.symbol} (Fee: {selectedPool.fee})</div>
            <div style={{fontSize: '0.8rem', color: '#888', marginTop: 2}}>{selectedPool.address}</div>
          </div>
        )}
      </div>

      {/* 模式切换 Tabs */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
        {['add', 'remove', 'collect'].map(m => (
            <button 
              key={m}
              onClick={() => setMode(m)}
              style={{
                  flex: 1,
                  padding: '10px', 
                  background: mode===m ? 'var(--primary)' : '#333', 
                  color: 'white', 
                  border:'none', 
                  borderRadius:'8px',
                  fontWeight: mode===m ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
              }}
            >
              {m === 'add' && '➕ 添加'}
              {m === 'remove' && '🔥 移除'}
              {m === 'collect' && '💰 收集'}
            </button>
        ))}
      </div>

      <div className="input-group">
        <label>Pool 地址 {selectedPool && <span style={{color: '#888'}}>(自动填充)</span>}</label>
        <input 
          value={poolAddr} 
          onChange={e=>setPoolAddr(e.target.value)} 
          placeholder="0x..." 
          disabled={!!selectedPool}
          style={{backgroundColor: selectedPool ? '#222' : '#111', color: selectedPool ? '#888' : 'white'}}
        />
      </div>
      
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15}}>
          <div className="input-group">
            <label>Tick 下界 (Lower)</label>
            <input value={tickLower} onChange={e=>setTickLower(e.target.value)} placeholder="-60" />
          </div>
          <div className="input-group">
            <label>Tick 上界 (Upper)</label>
            <input value={tickUpper} onChange={e=>setTickUpper(e.target.value)} placeholder="60" />
          </div>
      </div>

      {/* --- 模式 A: 添加流动性 --- */}
      {mode === 'add' && (
        <div className="fade-in">
          <div className="input-group">
            <label>流动性数量 (Liquidity Amount)</label>
            <input value={liqAmount} onChange={e=>setLiqAmount(e.target.value)} placeholder="1000" />
            <small style={{color:'#666', display:'block', marginTop:6}}>
              注意：此处填写的是计算后的 Liquidity 值，非 Token 数量。
            </small>
          </div>
          
          {quote && (
            <div className="data-card" style={{marginTop: 14, borderLeft: '4px solid var(--primary)'}}>
              <div style={{fontSize: '0.9rem', color: '#888'}}>预估需要存入:</div>
              <div style={{fontSize: '1.1rem', marginTop: 5}}><b>{quote.amount0.toString()}</b> {quote.token0Symbol}</div>
              <div style={{fontSize: '1.1rem'}}><b>{quote.amount1.toString()}</b> {quote.token1Symbol}</div>
            </div>
          )}

          <div style={{display:'flex', gap: 10, marginTop: 15}}>
            <button onClick={handleQuote} disabled={busy} className="action-btn" style={{background: '#333', flex: 1}}>
              {busy ? '计算中...' : '1. 报价计算'}
            </button>
            <button className="action-btn" onClick={handleAddLiquidityCheck} disabled={busy || !quote} style={{flex: 2}}>
              {busy ? '处理中...' : '2. 确认添加'}
            </button>
          </div>
        </div>
      )}

      {/* --- 模式 B: 移除流动性 --- */}
      {mode === 'remove' && (
        <div className="fade-in">
          <div className="input-group">
            <label>移除数量 (Liquidity Amount)</label>
            <input value={liqAmount} onChange={e=>setLiqAmount(e.target.value)} placeholder="1000" />
          </div>
          
          <div style={{display:'flex', gap: 10, marginBottom: 15}}>
            <button onClick={handleGetPosition} disabled={busy} style={{padding:'8px 12px', background: 'transparent', border: '1px solid #444', color: '#aaa', borderRadius: 4, cursor:'pointer'}}>
              查询我的持仓
            </button>
          </div>
          
          {position && (
            <div className="data-card" style={{marginTop: 14, backgroundColor: '#1a2332'}}>
              <h4 style={{margin: '0 0 10px 0', display:'flex', alignItems:'center', gap:5}}><Info size={16}/> 当前链上持仓</h4>
              <div><b>流动性余额:</b> {position.liquidity.toString()}</div>
              <div style={{fontSize: '0.9rem', color: '#888', marginTop: 5}}>待收 Token0: {position.tokensOwed0.toString()}</div>
              <div style={{fontSize: '0.9rem', color: '#888'}}>待收 Token1: {position.tokensOwed1.toString()}</div>
            </div>
          )}
          
          {burnQuote && (
             <div className="data-card" style={{marginTop: 10, borderLeft: '4px solid #e63946'}}>
               <p style={{margin:0, color: '#e63946'}}>预估赎回:</p>
               <div>{burnQuote.amount0.toString()} {burnQuote.token0Symbol}</div>
               <div>{burnQuote.amount1.toString()} {burnQuote.token1Symbol}</div>
             </div>
          )}
          
          <div style={{display:'flex', gap: 10, marginTop: 15}}>
             <button onClick={handleQuoteBurn} disabled={busy} className="action-btn" style={{background: '#333', flex: 1}}>
                1. 试算赎回
             </button>
             <button 
                className="action-btn" 
                style={{backgroundColor: '#e63946', flex: 2}} 
                onClick={handleRemoveLiquidityCheck} 
                disabled={busy || !burnQuote}
              >
                2. 确认移除
              </button>
          </div>
        </div>
      )}

      {/* --- 模式 C: 收集费用 --- */}
      {mode === 'collect' && (
        <div className="fade-in">
          <div className="data-card" style={{marginBottom: 14, display:'flex', gap: 10, alignItems: 'flex-start'}}>
            <AlertTriangle size={24} color="orange" />
            <div>
                 <p style={{margin: '0 0 5px 0', fontWeight: 'bold'}}>关于费用收集</p>
                 <p style={{margin: 0, fontSize: '0.9rem', color: '#aaa'}}>
                    移除流动性后，资产并不会自动进入钱包，而是暂存在协议中。您必须点击下方的"收集费用"才能将本金和手续费一并提现。
                 </p>
            </div>
          </div>
          
          {position && (
            <div className="data-card" style={{backgroundColor: '#1a3a1a'}}>
              <h4 style={{margin: '0 0 10px 0', color: '#4ade80'}}>可提取余额</h4>
              <div style={{fontSize: '1.2rem'}}><b>{position.tokensOwed0.toString()}</b> Token0</div>
              <div style={{fontSize: '1.2rem'}}><b>{position.tokensOwed1.toString()}</b> Token1</div>
            </div>
          )}
          
          <div style={{display:'flex', gap: 10, marginTop: 15}}>
            <button onClick={handleGetPosition} disabled={busy} className="action-btn" style={{background: '#333'}}>
              查询余额
            </button>
            <button className="action-btn" onClick={handleCollectFees} disabled={busy} style={{background: '#2e7d32'}}>
              一键提取到钱包
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiquidityPage;