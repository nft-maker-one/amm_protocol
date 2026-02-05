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
  approveIfNeeded,
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

  // --- 新增：池子状态信息 ---
  const [poolInfo, setPoolInfo] = useState(null); // { currentTick, tickSpacing, initialized }

  // --- 新增：确认弹窗状态 ---
  const [isAddConfirmOpen, setIsAddConfirmOpen] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

  // 当选择池子时更新池子地址和获取池子信息
  const handlePoolSelect = async (pool) => {
    setSelectedPool(pool);
    if (pool && window.ethereum) {
      setPoolAddr(pool.address);
      // 获取池子的当前状态
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
      // 重置报价状态
      setQuote(null);
      setBurnQuote(null);
    }
  };

  // --- 新增：根据当前 Tick 建议合理的 Tick 范围 ---
  const handleSuggestTickRange = () => {
    if (!poolInfo) {
      toast.error('请先选择池子');
      return;
    }
    const { currentTick, tickSpacing } = poolInfo;
    const range = 200; // ±200 的范围
    const suggestedLower = Math.floor((currentTick - range) / tickSpacing) * tickSpacing;
    const suggestedUpper = Math.ceil((currentTick + range) / tickSpacing) * tickSpacing;
    
    setTickLower(suggestedLower.toString());
    setTickUpper(suggestedUpper.toString());
    
    toast.success(`✅ 已建议 Tick 范围: [${suggestedLower}, ${suggestedUpper}]`, { duration: 3000 });
  };

  // --- 1. 报价逻辑 (Mint Quote) ---
  const handleQuote = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!selectedPool || !ethers.isAddress(selectedPool.address)) return toast.error('请先选择一个有效的池子');
    if (!tickLower || !tickUpper) return toast.error('请输入 tickLower / tickUpper');
    
    const toastId = toast.loading('正在报价...');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const recipient = await signer.getAddress();
      const pool = getPoolContract(provider, selectedPool.address);
      const [t0, t1, tickSpacing] = await Promise.all([
        pool.token0(),
        pool.token1(),
        pool.tickSpacing(),
      ]);

      // 授权代币（必须做，因为 staticCall 会检查权限）
      toast.loading('正在授权代币...', { id: toastId });
      const maxApprove = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      
      await Promise.allSettled([
        approveIfNeeded(provider, signer, t0, selectedPool.address, maxApprove),
        approveIfNeeded(provider, signer, t1, selectedPool.address, maxApprove)
      ]);

      // 使用调试版本的 quoteMint 来获取详细的错误信息
      toast.loading('正在计算所需代币...', { id: toastId });
      const q = await quoteMint(
        provider,
        selectedPool.address,
        recipient,
        Number(tickLower),
        Number(tickUpper),
        BigInt(liqAmount)
      );
      
      const t0Meta = findTokenByAddress(t0);
      const t1Meta = findTokenByAddress(t1);

      setQuote({ 
        ...q, 
        token0: t0, 
        token1: t1,
        token0Symbol: t0Meta?.symbol || 'Token0',
        token1Symbol: t1Meta?.symbol || 'Token1'
      });
      
      console.log('[handleQuote] quote 已设置:', { 
        amount0: q.amount0?.toString(), 
        amount1: q.amount1?.toString(),
        token0Symbol: t0Meta?.symbol || 'Token0',
        token1Symbol: t1Meta?.symbol || 'Token1'
      });

      toast.success('报价成功', { id: toastId });
    } catch (err) {
      console.error('[handleQuote] 完整错误信息:', err);
      
      // 尝试给出更好的错误提示
      let errorMsg = err.message || String(err);
      
      // 检查是否是 tick 对齐问题
      if (err.message && err.message.includes('not aligned with tickSpacing')) {
        try {
          // 如果有 Pool，尝试读取 tickSpacing 并给出建议
          const pool = getPoolContract(provider, selectedPool.address);
          const tickSpacing = await pool.tickSpacing();
          const ts = Number(tickSpacing);
          
          // 提示用户有效的 tick 值
          const suggestedLower = (Number(tickLower) / ts) * ts;
          const suggestedUpper = (Number(tickUpper) / ts) * ts;
          
          errorMsg += `\n\n提示: Pool 的 tickSpacing 是 ${ts}。\n` +
                      `你可以尝试:\n` +
                      `  - tickLower: ${suggestedLower} (或其他 ${ts} 的倍数)\n` +
                      `  - tickUpper: ${suggestedUpper} (或其他 ${ts} 的倍数)`;
        } catch (e) {
          // 如果读取失败，忽略
        }
      }
      
      toast.error('报价失败: ' + errorMsg, { id: toastId });
    } finally {
      setBusy(false);
    }
  };
  // --- 2. 添加流动性逻辑 (分为 Check 和 Execute) ---
  const handleAddLiquidityCheck = () => {
     console.log('[handleAddLiquidityCheck] 被调用, quote=', quote);
     if (!quote) return toast.error("请先点击'报价'以确认数量");
     if (!selectedPool || !ethers.isAddress(selectedPool.address)) return toast.error("请先选择一个有效的池子");
     console.log('[handleAddLiquidityCheck] 打开确认弹窗');
     setIsAddConfirmOpen(true); // 打开确认框
  };

  const executeAddLiquidity = async () => {
    console.log('[executeAddLiquidity] 开始执行添加流动性');
    setIsAddConfirmOpen(false); // 关闭弹窗
    if (!window.ethereum) return toast.error('请先连接钱包');

    const addPromise = (async () => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const res = await addLiquidity(
        provider,
        signer,
        selectedPool.address,
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
    if (!selectedPool || !ethers.isAddress(selectedPool.address)) return toast.error('请先选择一个有效的池子');
    if (!position) return toast.error('⚠️ 请先点击"🔍 查询我的持仓"获取实时数据');
    
    // 验证赎回数量
    const burnAmount = BigInt(liqAmount);
    if (burnAmount <= 0n) return toast.error('请输入要赎回的数量（> 0）');
    if (burnAmount > position.liquidity) {
      return toast.error(
        `❌ 赎回数量过多！您要赎回 ${burnAmount.toString()}，但实际持仓只有 ${position.liquidity.toString()}`
      );
    }

    const toastId = toast.loading('正在计算赎回金额...');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      console.log('[handleQuoteBurn] 调用 quoteBurn:');
      console.log('  - selectedPool.address:', selectedPool.address);
      console.log('  - tickLower:', tickLower);
      console.log('  - tickUpper:', tickUpper);
      console.log('  - burnAmount:', burnAmount.toString());
      console.log('  - position.liquidity:', position.liquidity.toString());

      const q = await quoteBurn(
        provider,
        selectedPool.address,
        Number(tickLower),
        Number(tickUpper),
        burnAmount
      );
      
      const t0Meta = findTokenByAddress(position.token0);
      const t1Meta = findTokenByAddress(position.token1);

      setBurnQuote({ 
          ...q, 
          token0: position.token0, 
          token1: position.token1,
          token0Symbol: t0Meta?.symbol || 'Token0',
          token1Symbol: t1Meta?.symbol || 'Token1',
          actualLiquidity: position.liquidity
      });
      
      toast.success('✅ 赎回报价计算成功！', { id: toastId });
    } catch (err) {
      console.error('[handleQuoteBurn] 错误:', err);
      
      let errorMsg = err.message || String(err);
      
      // 更友好的错误提示
      if (errorMsg.includes('没有流动性持仓')) {
        // 已经是很好的诊断信息了
      } else if (errorMsg.includes('Insufficient liquidity')) {
        errorMsg = '❌ 该 Tick 范围内流动性不足\n\n' +
                   '诊断结果表明您在此 Tick 范围内可能没有持仓。\n\n' +
                   '解决方案：\n' +
                   '1️⃣ 点击"🔍 查询我的持仓"确认实际范围\n' +
                   '2️⃣ 如果查询结果为 0，说明流动性已被赎回\n' +
                   '3️⃣ 使用"💡 建议范围"查看有流动性的范围';
      } else if (errorMsg.includes('not aligned')) {
        errorMsg = '❌ Tick 参数未对齐\n\n请使用"💡 建议范围"按钮自动调整';
      }
      
      toast.error(errorMsg, { id: toastId, duration: 5000 });
    } finally {
      setBusy(false);
    }
  };

  // --- 4. 移除流动性逻辑 (分为 Check 和 Execute) ---
  const handleRemoveLiquidityCheck = () => {
      if (!burnQuote) return toast.error("请先点击'报价'预览结果");
      if (!position) return toast.error("⚠️ 持仓信息缺失，请重新点击'报价'");
      
      const burnAmount = BigInt(liqAmount);
      if (burnAmount > position.liquidity) {
        return toast.error(`❌ 赎回数量 ${burnAmount.toString()} 超过持仓 ${position.liquidity.toString()}`);
      }
      
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
        selectedPool.address,
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
    const toastId = toast.loading('正在查询链上持仓...');
    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const owner = await signer.getAddress();
      
      console.log('[handleGetPosition] 查询持仓:');
      console.log('  - poolAddr:', selectedPool ? selectedPool.address : 'N/A');
      console.log('  - owner:', owner);
      console.log('  - tickLower:', tickLower);
      console.log('  - tickUpper:', tickUpper);

      const pos = await getPosition(
        provider,
        selectedPool.address,
        owner,
        Number(tickLower),
        Number(tickUpper)
      );
      
      console.log('[handleGetPosition] 查询结果:', {
        liquidity: pos.liquidity.toString(),
        tokensOwed0: pos.tokensOwed0.toString(),
        tokensOwed1: pos.tokensOwed1.toString(),
      });

      setPosition(pos);
      
      // 给出诊断信息
      if (pos.liquidity === 0n) {
        toast(
          `⚠️ 在 Tick 范围 [${tickLower}, ${tickUpper}] 内无流动性持仓！\n\n建议：\n1. 检查 Tick 范围是否正确\n2. 点击"💡 建议范围"查看有流动性的范围`,
          { id: toastId, duration: 4000 }
        );
      } else {
        toast.success(
          `✅ 查询成功！\n持仓: ${pos.liquidity.toString()} LP\n待收token0: ${pos.tokensOwed0.toString()}\n待收token1: ${pos.tokensOwed1.toString()}`,
          { id: toastId, duration: 3000 }
        );
      }
    } catch (err) {
      console.error('[handleGetPosition] 查询失败:', err);
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
            selectedPool.address,
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
                     <p style={{margin: '0 0 10px 0', color: '#aaa', fontSize: '0.9rem'}}>您将存入：</p>
                     <div style={{display:'flex', justifyContent:'space-between', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: 8}}>
                         <span>{quote.token0Symbol}</span>
                         <span style={{color: '#64ff00'}}>{quote.amount0.toString()}</span>
                     </div>
                     <div style={{display:'flex', justifyContent:'space-between', fontSize: '1.2rem', fontWeight: 'bold'}}>
                         <span>{quote.token1Symbol}</span>
                         <span style={{color: '#00d4ff'}}>{quote.amount1.toString()}</span>
                     </div>
                 </div>
                 <div style={{fontSize: '0.85rem', color: '#aaa', margin: '15px 0', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px'}}>
                     <p style={{display:'flex', alignItems:'center', gap: 5, margin: '5px 0'}}>
                        <Info size={14}/> 包含 approve 和 mint 两步操作
                     </p>
                     <p style={{margin: '5px 0'}}>📍 Tick范围: {tickLower} ~ {tickUpper}</p>
                 </div>
                 <div style={{display: 'flex', gap: '1rem', marginTop: '1.5rem'}}>
                     <button className="modal-cancel-btn" onClick={() => setIsAddConfirmOpen(false)} style={{flex: 1}}>
                       取消
                     </button>
                     <button className="action-btn" onClick={executeAddLiquidity} style={{flex: 1, marginTop: 0}}>
                       确认存入
                     </button>
                 </div>
             </div>
         )}
      </Modal>

      {/* --- Modal 2: 移除流动性确认 --- */}
      <Modal isOpen={isRemoveConfirmOpen} onClose={() => setIsRemoveConfirmOpen(false)} title="确认移除流动性">
         {burnQuote && position && (
             <div>
                 {/* 实际持仓信息 */}
                 <div style={{padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #333'}}>
                     <div style={{fontSize: '0.85rem', color: '#aaa', marginBottom: '6px'}}>💾 您的实际持仓：</div>
                     <div style={{fontSize: '1.1rem', fontWeight: 'bold', color: '#4ade80'}}>{position.liquidity.toString()} LP</div>
                 </div>

                 <div style={{backgroundColor: 'rgba(230, 57, 70, 0.15)', border: '1px solid #e63946', borderRadius: '6px', padding: '12px', marginBottom: '1rem'}}>
                     <p style={{color: '#e63946', fontWeight: 'bold', margin: '0', display: 'flex', alignItems: 'center', gap: 8}}>
                        <AlertTriangle size={18}/> 您将销毁 {liqAmount} LP 凭证
                     </p>
                 </div>
                 <div className="data-card">
                     <p style={{margin: '0 0 10px 0', color: '#aaa', fontSize: '0.9rem'}}>预计取回：</p>
                     <div style={{display:'flex', justifyContent:'space-between', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: 8}}>
                         <span>{burnQuote.token0Symbol}</span>
                         <span style={{color: '#64ff00'}}>{burnQuote.amount0.toString()}</span>
                     </div>
                     <div style={{display:'flex', justifyContent:'space-between', fontSize: '1.2rem', fontWeight: 'bold'}}>
                         <span>{burnQuote.token1Symbol}</span>
                         <span style={{color: '#00d4ff'}}>{burnQuote.amount1.toString()}</span>
                     </div>
                 </div>
                 <div style={{fontSize: '0.8rem', color: '#ffd700', margin: '1rem 0', padding: '10px', backgroundColor: 'rgba(255, 215, 0, 0.1)', borderRadius: '6px', border: '1px solid rgba(255, 215, 0, 0.2)'}}>
                     <p style={{margin: '0', display: 'flex', alignItems: 'center', gap: 6}}>
                        <Info size={14}/> 代币不会直接进入钱包，需要执行"收集费用"
                     </p>
                 </div>
                 <div style={{display: 'flex', gap: '1rem', marginTop: '1.5rem'}}>
                     <button className="modal-cancel-btn" onClick={() => setIsRemoveConfirmOpen(false)} style={{flex: 1}}>
                       取消
                     </button>
                     <button className="action-btn" style={{backgroundColor: '#e63946', flex: 1, marginTop: 0}} onClick={executeRemoveLiquidity}>
                       确认销毁移除
                     </button>
                 </div>
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

      {/* 池子状态信息和建议按钮 */}
      {poolInfo && (
        <div style={{padding: '12px', backgroundColor: '#151515', borderRadius: '8px', marginBottom: '15px', border: '1px solid #333'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={{fontSize: '0.9rem'}}>
              <div style={{color: '#aaa'}}>当前 Tick: <span style={{color: '#00ff00', fontWeight: 'bold'}}>{poolInfo.currentTick}</span></div>
              <div style={{color: '#aaa', marginTop: 4}}>Tick Spacing: <span style={{color: '#00d4ff', fontWeight: 'bold'}}>{poolInfo.tickSpacing}</span></div>
            </div>
            <button 
              onClick={handleSuggestTickRange}
              style={{padding: '8px 16px', backgroundColor: '#4ade80', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem'}}
            >
              💡 建议范围
            </button>
          </div>
          {!poolInfo.initialized && (
            <div style={{marginTop: '8px', padding: '8px', backgroundColor: 'rgba(255, 159, 64, 0.2)', borderRadius: '4px', color: '#ffb347', fontSize: '0.85rem'}}>
              ⚠️ 池子未初始化，请先在部署页面初始化
            </div>
          )}
        </div>
      )}

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

          {/* 危险警告：Tick 范围不包含当前 Tick */}
          {poolInfo && (Number(tickLower) > poolInfo.currentTick || Number(tickUpper) < poolInfo.currentTick) && (
            <div style={{padding: '12px', backgroundColor: 'rgba(230, 57, 70, 0.15)', border: '1px solid #e63946', borderRadius: '8px', marginBottom: '15px', color: '#e63946', fontSize: '0.9rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <AlertTriangle size={18} />
                <div>
                  <b>⚠️ 警告</b>：您选择的 Tick 范围 [{tickLower}, {tickUpper}] <b>不包含</b>当前 Tick ({poolInfo.currentTick})，该流动性<b>将无法被交换使用</b>！
                  <div style={{marginTop: 6}}>请点击上方"💡 建议范围"自动调整到合适的范围。</div>
                </div>
              </div>
            </div>
          )}
          
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
          {/* 先查询持仓的提示 */}
          {!position && (
            <div style={{padding: '12px', backgroundColor: 'rgba(100, 200, 255, 0.15)', border: '1px solid #00d4ff', borderRadius: '8px', marginBottom: '15px', color: '#00d4ff', fontSize: '0.9rem'}}>
              <b>💡 提示</b>：请先点击下方的"查询我的持仓"按钮，查看您在该 Tick 范围内的实际流动性余额。
            </div>
          )}

          {/* 持仓信息卡 */}
          {position && (
            <div className="data-card" style={{marginTop: 0, marginBottom: 15, backgroundColor: '#1a2332', borderLeft: '4px solid #4ade80'}}>
              <h4 style={{margin: '0 0 10px 0', display:'flex', alignItems:'center', gap:5, color: '#4ade80'}}>
                <Info size={16}/> 当前持仓
              </h4>
              <div style={{fontSize: '1.1rem', fontWeight: 'bold', color: '#4ade80', marginBottom: 8}}>
                💾 流动性: {position.liquidity.toString()}
              </div>
              <div style={{fontSize: '0.85rem', color: '#aaa'}}>
                <div>⏳ 待收 Token0: {position.tokensOwed0.toString()}</div>
                <div>⏳ 待收 Token1: {position.tokensOwed1.toString()}</div>
              </div>
            </div>
          )}

          <div className="input-group">
            <label>移除数量 (Liquidity Amount to Burn)</label>
            <input value={liqAmount} onChange={e=>setLiqAmount(e.target.value)} placeholder="输入要赎回的 LP 数量" />
            {position && (
              <small style={{color: '#aaa', display:'block', marginTop: 6}}>
                可赎回最大值: <span style={{color: '#4ade80', fontWeight: 'bold'}}>{position.liquidity.toString()}</span>
              </small>
            )}
          </div>

          {/* 验证提示 */}
          {position && BigInt(liqAmount || 0) > position.liquidity && (
            <div style={{padding: '10px', backgroundColor: 'rgba(230, 57, 70, 0.15)', border: '1px solid #e63946', borderRadius: '6px', marginBottom: '15px', color: '#e63946', fontSize: '0.9rem'}}>
              ❌ 您要赎回的数量 ({liqAmount}) 超过实际持仓 ({position.liquidity.toString()})
            </div>
          )}
          
          <div style={{display:'flex', gap: 10, marginBottom: 15}}>
            <button onClick={handleGetPosition} disabled={busy} style={{padding:'10px 12px', background: '#333', color: '#aaa', border: '1px solid #444', borderRadius: 4, cursor:'pointer', flex: 1, fontWeight: 'bold'}}>
              {busy ? '查询中...' : '🔍 查询我的持仓'}
            </button>
          </div>
          
          {burnQuote && (
            <div className="data-card" style={{marginTop: 14, borderLeft: '4px solid #e63946'}}>
              <div style={{fontSize: '0.9rem', color: '#888'}}>预计取回:</div>
              <div style={{fontSize: '1.1rem', marginTop: 5}}><b>{burnQuote.amount0.toString()}</b> {burnQuote.token0Symbol}</div>
              <div style={{fontSize: '1.1rem'}}><b>{burnQuote.amount1.toString()}</b> {burnQuote.token1Symbol}</div>
            </div>
          )}

          <div style={{display:'flex', gap: 10, marginTop: 15}}>
            <button onClick={handleQuoteBurn} disabled={busy || !position} className="action-btn" style={{background: '#333', flex: 1}}>
              {busy ? '计算中...' : '1. 赎回报价'}
            </button>
            <button className="action-btn" onClick={handleRemoveLiquidityCheck} disabled={busy || !burnQuote || (position && BigInt(liqAmount || 0) > position.liquidity)} style={{flex: 2, backgroundColor: '#e63946'}}>
              {busy ? '处理中...' : '2. 确认赎回'}
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