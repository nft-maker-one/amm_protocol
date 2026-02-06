import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { X, Info, AlertTriangle, ArrowRight } from 'lucide-react';

import { findTokenByAddress } from '../api/tokens';
import { getPoolList } from '../api/pools'; // 确保这里引用正确
import PoolInfoCard from '../components/ui/PoolInfoCard'; // 引入统一组件
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
  approveIfNeeded,
} from '../api/amm';

// --- 通用 Modal 组件 (样式保持和 SwapPage 一致) ---
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
      <div className="modal-content" style={{background:'#1a1a1a', padding:20, borderRadius:12, width:'90%', maxWidth:500, border:'1px solid #333'}}>
        <div className="modal-header" style={{display:'flex', justifyContent:'space-between', marginBottom:20}}>
          <h3 style={{margin:0}}>{title}</h3>
          <button onClick={onClose} style={{background:'none', border:'none', color:'#aaa', cursor:'pointer'}}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{maxHeight:'60vh', overflowY:'auto'}}>
          {children}
        </div>
      </div>
    </div>
  );
};

const LiquidityPage = () => {
  const [mode, setMode] = useState('add'); // 'add', 'remove', 'collect'
  
  // 池子选择相关状态
  const [poolList, setPoolList] = useState([]);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);

  const [poolAddr, setPoolAddr] = useState(AMMPOOL_ADDRESS);
  const [tickLower, setTickLower] = useState('-60');
  const [tickUpper, setTickUpper] = useState('60');
  const [liqAmount, setLiqAmount] = useState('1000');
  
  const [quote, setQuote] = useState(null);
  const [burnQuote, setBurnQuote] = useState(null); 
  const [position, setPosition] = useState(null); 
  const [busy, setBusy] = useState(false);
  const [poolInfo, setPoolInfo] = useState(null);

  const [isAddConfirmOpen, setIsAddConfirmOpen] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

  // 初始化加载池子列表
  useEffect(() => {
    const list = getPoolList();
    setPoolList(list);
    // 如果有池子且未选择，默认选第一个
    if (list.length > 0 && !selectedPool) {
      handlePoolSelect(list[0]);
    }
  }, []);

  const handlePoolSelect = async (pool) => {
    setSelectedPool(pool);
    setIsPoolModalOpen(false); // 关闭弹窗
    if (pool && window.ethereum) {
      setPoolAddr(pool.address);
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const poolContract = getPoolContract(provider, pool.address);
        const [slot0, tickSpacing] = await Promise.all([
          poolContract.slot0(),
          poolContract.tickSpacing(),
        ]);
        setPoolInfo({
          currentTick: Number(slot0.tick),
          tickSpacing: Number(tickSpacing),
          initialized: slot0.sqrtPriceX96 !== 0n,
        });
      } catch (err) {
        console.error('Failed to fetch pool info:', err);
      }
      setQuote(null);
      setBurnQuote(null);
      setPosition(null);
    }
  };

  const handleSuggestTickRange = () => {
    if (!poolInfo) return toast.error('请先选择池子');
    const { currentTick, tickSpacing } = poolInfo;
    const range = tickSpacing * 10; // 建议范围为 10 个 tickSpacing
    const suggestedLower = Math.floor((currentTick - range) / tickSpacing) * tickSpacing;
    const suggestedUpper = Math.ceil((currentTick + range) / tickSpacing) * tickSpacing;
    setTickLower(suggestedLower.toString());
    setTickUpper(suggestedUpper.toString());
    toast.success(`✅ 已建议 Tick 范围: [${suggestedLower}, ${suggestedUpper}]`);
  };

  // --- 业务逻辑保持不变 ---
  const handleQuote = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!selectedPool) return toast.error('请先选择一个有效的池子');
    if (!tickLower || !tickUpper) return toast.error('请输入 Tick 范围');
    
    const toastId = toast.loading('正在报价...');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const recipient = await signer.getAddress();
      const pool = getPoolContract(provider, selectedPool.address);
      const [t0, t1] = await Promise.all([pool.token0(), pool.token1()]);

      const maxApprove = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      await Promise.allSettled([
        approveIfNeeded(provider, signer, t0, selectedPool.address, maxApprove),
        approveIfNeeded(provider, signer, t1, selectedPool.address, maxApprove)
      ]);

      const q = await quoteMint(provider, selectedPool.address, recipient, Number(tickLower), Number(tickUpper), BigInt(liqAmount));
      
      const t0Meta = findTokenByAddress(t0);
      const t1Meta = findTokenByAddress(t1);

      setQuote({ 
        ...q, token0: t0, token1: t1,
        token0Symbol: t0Meta?.symbol || 'Token0',
        token1Symbol: t1Meta?.symbol || 'Token1'
      });
      toast.success('报价成功', { id: toastId });
    } catch (err) {
      toast.error('报价失败: ' + err.message, { id: toastId });
    } finally { setBusy(false); }
  };

  const handleAddLiquidityCheck = () => {
     if (!quote) return toast.error("请先点击'报价'");
     setIsAddConfirmOpen(true);
  };

  const executeAddLiquidity = async () => {
    setIsAddConfirmOpen(false);
    const addPromise = (async () => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const res = await addLiquidity(provider, signer, selectedPool.address, Number(tickLower), Number(tickUpper), BigInt(liqAmount));
      return res.tx.hash;
    })();
    toast.promise(addPromise, { loading: '添加中...', success: '添加成功!', error: (e) => e.message });
  };

  const handleGetPosition = async () => {
    if (!window.ethereum) return toast.error('请连接钱包');
    const toastId = toast.loading('查询持仓...');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const owner = await signer.getAddress();
      const pos = await getPosition(provider, selectedPool.address, owner, Number(tickLower), Number(tickUpper));
      setPosition(pos);
      if (pos.liquidity === 0n) toast('该范围内无持仓', { id: toastId });
      else toast.success(`持仓: ${pos.liquidity}`, { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally { setBusy(false); }
  };

  const handleQuoteBurn = async () => {
    if (!position || position.liquidity === 0n) return toast.error('无持仓，无法计算赎回');
    const toastId = toast.loading('计算赎回...');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const q = await quoteBurn(provider, selectedPool.address, Number(tickLower), Number(tickUpper), BigInt(liqAmount));
      const t0Meta = findTokenByAddress(position.token0);
      const t1Meta = findTokenByAddress(position.token1);
      setBurnQuote({ 
          ...q, token0: position.token0, token1: position.token1,
          token0Symbol: t0Meta?.symbol || 'Token0', token1Symbol: t1Meta?.symbol || 'Token1'
      });
      toast.success('计算成功', { id: toastId });
    } catch (err) { toast.error(err.message, { id: toastId }); } finally { setBusy(false); }
  };

  const executeRemoveLiquidity = async () => {
    setIsRemoveConfirmOpen(false);
    const removePromise = (async () => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const res = await removeLiquidity(provider, signer, selectedPool.address, Number(tickLower), Number(tickUpper), BigInt(liqAmount));
      return res.tx.hash;
    })();
    toast.promise(removePromise, { loading: '移除中...', success: '移除成功! 请收集费用', error: (e) => e.message });
  };

  const handleCollectFees = async () => {
    const collectPromise = (async () => {
       setBusy(true);
       const provider = new ethers.BrowserProvider(window.ethereum);
       const signer = await provider.getSigner();
       const MaxUint128 = 2n ** 128n - 1n;
       const tx = await collectFees(provider, signer, selectedPool.address, Number(tickLower), Number(tickUpper), MaxUint128, MaxUint128);
       return tx.hash;
    })();
    toast.promise(collectPromise, { loading: '收集费用中...', success: () => { setBusy(false); return '收集成功!'; }, error: (e) => { setBusy(false); return e.message; } });
  };

  return (
    <div className="container">
      <h2>💧 流动性管理</h2>

      {/* --- 统一的池子选择区域 --- */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{margin: '0 0 10px 0', color: '#888', fontSize:'0.9rem'}}>选择目标交易对</h4>
        {selectedPool ? (
          <PoolInfoCard 
            pool={selectedPool} 
            isActive={true} 
            onClick={() => setIsPoolModalOpen(true)}
            showDetails={true}
          />
        ) : (
          <div 
            onClick={() => setIsPoolModalOpen(true)} 
            style={{padding:20, border:'2px dashed #444', borderRadius:12, textAlign:'center', cursor:'pointer', color:'#aaa'}}
          >
            + 点击选择交易对
          </div>
        )}
      </div>

      {/* 模式切换 Tabs */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '20px', background:'#1a1a1a', padding:5, borderRadius:10}}>
        {['add', 'remove', 'collect'].map(m => (
            <button 
              key={m} onClick={() => setMode(m)}
              style={{
                  flex: 1, padding: '10px', background: mode===m ? '#646cff' : 'transparent', 
                  color: mode===m?'white':'#888', border:'none', borderRadius:'8px', cursor: 'pointer', transition: 'all 0.2s', fontWeight:'bold'
              }}
            >
              {m === 'add' && '➕ 添加'}
              {m === 'remove' && '🔥 移除'}
              {m === 'collect' && '💰 收集'}
            </button>
        ))}
      </div>

      {/* Tick 范围设置 (公共区域) */}
      <div className="data-card" style={{marginBottom:20}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:10}}>
           <span>Tick 范围设置</span>
           {poolInfo && <span onClick={handleSuggestTickRange} style={{color:'#4ade80', cursor:'pointer', fontSize:'0.85rem'}}>💡 使用建议范围</span>}
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15}}>
          <div className="input-group" style={{margin:0}}>
            <label>Tick Lower</label>
            <input value={tickLower} onChange={e=>setTickLower(e.target.value)} placeholder="-60" style={{textAlign:'center'}}/>
          </div>
          <div className="input-group" style={{margin:0}}>
            <label>Tick Upper</label>
            <input value={tickUpper} onChange={e=>setTickUpper(e.target.value)} placeholder="60" style={{textAlign:'center'}}/>
          </div>
        </div>
        {poolInfo && (
           <div style={{marginTop:10, fontSize:'0.8rem', color:'#666', textAlign:'center'}}>
             当前 Tick: <span style={{color:'#fff'}}>{poolInfo.currentTick}</span> | Spacing: {poolInfo.tickSpacing}
           </div>
        )}
      </div>

      {/* --- 模式 A: 添加 --- */}
      {mode === 'add' && (
        <div className="fade-in">
          <div className="input-group">
            <label>流动性数量 (Liquidity)</label>
            <input value={liqAmount} onChange={e=>setLiqAmount(e.target.value)} placeholder="1000" />
          </div>
          {quote && (
            <div className="data-card" style={{borderLeft: '4px solid #4ade80'}}>
               <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span>需存入 {quote.token0Symbol}</span>
                  <b>{quote.amount0.toString()}</b>
               </div>
               <div style={{display:'flex', justifyContent:'space-between', marginTop:5}}>
                  <span>需存入 {quote.token1Symbol}</span>
                  <b>{quote.amount1.toString()}</b>
               </div>
            </div>
          )}
          <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:10, marginTop:15}}>
            <button onClick={handleQuote} disabled={busy} className="action-btn" style={{background:'#333'}}>1. 报价</button>
            <button className="action-btn" onClick={handleAddLiquidityCheck} disabled={busy || !quote}>2. 确认添加</button>
          </div>
        </div>
      )}

      {/* --- 模式 B: 移除 --- */}
      {mode === 'remove' && (
        <div className="fade-in">
          <div className="input-group">
            <label>移除数量</label>
            <input value={liqAmount} onChange={e=>setLiqAmount(e.target.value)} placeholder="输入 LP 数量" />
          </div>
          {position && <div style={{fontSize:'0.8rem', color:'#aaa', marginBottom:10}}>当前持仓: {position.liquidity.toString()} LP</div>}
          
          <div style={{display:'flex', gap:10, marginBottom:10}}>
             <button onClick={handleGetPosition} className="action-btn" style={{background:'#333', fontSize:'0.9rem'}}>🔍 查询我的持仓</button>
          </div>

          {burnQuote && (
             <div className="data-card" style={{borderLeft: '4px solid #e63946'}}>
               <div style={{color:'#aaa', fontSize:'0.9rem'}}>预计取回</div>
               <div>{burnQuote.amount0.toString()} {burnQuote.token0Symbol}</div>
               <div>{burnQuote.amount1.toString()} {burnQuote.token1Symbol}</div>
             </div>
          )}

          <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:10, marginTop:15}}>
             <button onClick={handleQuoteBurn} disabled={busy || !position} className="action-btn" style={{background:'#333'}}>1. 计算赎回</button>
             <button onClick={() => setIsRemoveConfirmOpen(true)} disabled={busy || !burnQuote} className="action-btn" style={{background:'#e63946'}}>2. 确认移除</button>
          </div>
        </div>
      )}

      {/* --- 模式 C: 收集 --- */}
      {mode === 'collect' && (
        <div className="fade-in">
           <div className="data-card" style={{borderLeft:'4px solid orange'}}>
              <h4 style={{marginTop:0, color:'orange'}}>💰 提取收益</h4>
              <p style={{fontSize:'0.9rem', color:'#aaa'}}>移除流动性后，Token 会暂存在合约中，需手动提取。</p>
              {position && (
                 <div style={{marginTop:10}}>
                    <div>待收 Token0: <b style={{color:'#fff'}}>{position.tokensOwed0.toString()}</b></div>
                    <div>待收 Token1: <b style={{color:'#fff'}}>{position.tokensOwed1.toString()}</b></div>
                 </div>
              )}
           </div>
           <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:10}}>
              <button onClick={handleGetPosition} className="action-btn" style={{background:'#333'}}>查询余额</button>
              <button onClick={handleCollectFees} className="action-btn" disabled={busy}>一键提取到钱包</button>
           </div>
        </div>
      )}

      {/* 弹窗：池子列表 */}
      <Modal isOpen={isPoolModalOpen} onClose={() => setIsPoolModalOpen(false)} title="选择交易对">
        {poolList.map(p => (
           <PoolInfoCard key={p.address} pool={p} isActive={selectedPool?.address === p.address} onClick={() => handlePoolSelect(p)} />
        ))}
      </Modal>

      {/* 弹窗：添加确认 */}
      <Modal isOpen={isAddConfirmOpen} onClose={() => setIsAddConfirmOpen(false)} title="确认添加">
         {quote && (
            <div style={{textAlign:'center'}}>
               <p>存入 {quote.amount0.toString()} {quote.token0Symbol}</p>
               <p>存入 {quote.amount1.toString()} {quote.token1Symbol}</p>
               <p style={{fontSize:'0.8rem', color:'#888'}}>Tick: {tickLower} ~ {tickUpper}</p>
               <button className="action-btn" onClick={executeAddLiquidity}>确认交易</button>
            </div>
         )}
      </Modal>

      {/* 弹窗：移除确认 */}
      <Modal isOpen={isRemoveConfirmOpen} onClose={() => setIsRemoveConfirmOpen(false)} title="确认销毁">
         <div style={{textAlign:'center', color:'#e63946'}}>
            <AlertTriangle size={48} style={{margin:'0 auto 10px'}}/>
            <p>确定移除 {liqAmount} LP 流动性吗？</p>
            <button className="action-btn" style={{background:'#e63946'}} onClick={executeRemoveLiquidity}>确认销毁</button>
         </div>
      </Modal>
    </div>
  );
};

export default LiquidityPage;