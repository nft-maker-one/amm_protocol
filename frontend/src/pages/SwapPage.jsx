import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast'; 
import { X, Settings, Eye, Copy } from 'lucide-react'; 

import AMMPoolABI from '../api/abi/AMMPool.json';
import { getTokenList, TOKENS, findTokenByAddress } from '../api/tokens';
import { getPoolList } from '../api/pools';
import {
  AMMPOOL_ADDRESS,
  ensureSepolia,
  getPool,
  readSlot0,
  getTokenInfo,
  getPoolContract,
  swapExactIn,
  estimateSwapOut,
  checkPoolStatus,
  // ⚠️ 注意：如果你的 amm.js 里没有 createPool，这两行可能还会报错。
  // 如果再次报错，请把下面这两行也注释掉
  createPool, 
  simulateCreatePool,
} from '../api/amm';

// --- 🚑 紧急修复：本地定义这些缺失的辅助函数 ---
// 这样就不会因为 import 不到而报错了
const addPoolToList = (pool) => {
  console.log("调用了 addPoolToList", pool);
};
const updatePoolInList = (addr, pool) => {
  console.log("调用了 updatePoolInList", addr, pool);
};

// --- 内部组件：通用模态框 ---
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

// --- Helper: 安全调用 View 函数 ---
async function safeCallView(provider, address, abi, fnName, args = []) {
  const iface = new ethers.Interface(abi);
  const data = iface.encodeFunctionData(fnName, args);
  const res = await provider.call({ to: address, data });
  if (!res || res === '0x') throw new Error(`${fnName} 返回空数据`);
  return iface.decodeFunctionResult(fnName, res);
}

const SwapPage = () => {
  // 动态 token 列表
  const [tokenList, setTokenList] = useState(getTokenList());
  
  // 已有交易对列表和模态框状态
  const [poolList, setPoolList] = useState(getPoolList());
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  
  // --- 状态变量 ---
  const [tokenAChoice, setTokenAChoice] = useState(TOKENS.USDT.address);
  const [tokenBChoice, setTokenBChoice] = useState(TOKENS.WETH.address);
  const [tokenACustom, setTokenACustom] = useState('');
  const [tokenBCustom, setTokenBCustom] = useState('');
  const [feeInput, setFeeInput] = useState('3000');
  const [payAmount, setPayAmount] = useState('');
  
  const [swapping, setSwapping] = useState(false);
  const [estOutInfo, setEstOutInfo] = useState(null); 
  const [slippagePct, setSlippagePct] = useState('1.0'); 

  // Pool 相关状态（已移除查找/创建池子功能）
  const [selectedPool, setSelectedPool] = useState(null);
  
  // 确认弹窗状态
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingTxArgs, setPendingTxArgs] = useState(null);

  // 监听 token 列表变化
  useEffect(() => {
    const updatedList = getTokenList();
    setTokenList(updatedList);
  }, []);

  const tokenA = tokenAChoice === 'custom' ? tokenACustom : tokenAChoice;
  const tokenB = tokenBChoice === 'custom' ? tokenBCustom : tokenBChoice;


  // --- 队友逻辑 3: 读取选中池子的 Slot0 ---
  const handleReadSlot0 = async () => {
    if (!selectedPool) return toast.error('请先选择一个池子');
    if (!window.ethereum) return toast.error('请先连接钱包');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const decoded = await safeCallView(provider, selectedPool.address, AMMPoolABI, 'slot0');
      
      const updatedPool = {
        ...selectedPool,
        isInitialized: true,
        sqrtPriceX96: decoded[0].toString(),
        currentTick: decoded[1].toString()
      };
      
      updatePoolInList(selectedPool.address, updatedPool);
      setSelectedPool(updatedPool);
      
      toast.success(`Slot0: ${decoded[0]} / ${decoded[1]}`, { duration: 4000 });
    } catch (err) {
      toast.error('读取 Slot0 失败: ' + err.message);
    }
  };
  
  // --- 队友逻辑 4: 查询全局 Slot0 ---
  const handleQuerySlot0 = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const decoded = await safeCallView(provider, AMMPOOL_ADDRESS, AMMPoolABI, 'slot0');
      toast(`Price: ${decoded[0]}\nTick: ${decoded[1]}`, {
          icon: 'ℹ️',
          style: { borderRadius: '10px', background: '#333', color: '#fff' },
      });
    } catch (err) {
      toast.error('查询失败: ' + (err.message || err));
    }
  };

  // --- Swap 检查 ---
  const handleSwapCheck = async () => {
    // 首先强制检查是否选择了池子
    if (!selectedPool) {
      return toast.error('❌ 请先选择一个交易对！\n\n点击下方"🔄 选择交易对"按钮选择有流动性的池子。');
    }

    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!payAmount || Number(payAmount) <= 0) return toast.error('请输入数量');
    
    setSwapping(true);
    const toastId = toast.loading('正在计算价格...');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      if (!ethers.isAddress(tokenA) || !ethers.isAddress(tokenB)) {
        toast.dismiss(toastId);
        setSwapping(false);
        return toast.error('Token 地址无效');
      }

      // 使用已选择的池子地址
      const poolAddr = selectedPool.address;
      
      if (!poolAddr || poolAddr === ethers.ZeroAddress) {
        toast.dismiss(toastId);
        setSwapping(false);
        return toast.error('未找到池子，请先创建');
      }

      // 检查池子初始化状态
      console.log(`🔍 检查池子初始化状态: ${poolAddr.slice(0,8)}...`);
      const poolStatus = await checkPoolStatus(provider, poolAddr);
      if (poolStatus.status !== 'INITIALIZED') {
        toast.dismiss(toastId);
        setSwapping(false);
        if (poolStatus.status === 'NOT_INITIALIZED') {
          return toast.error('❌ 池子未初始化！需要先在部署页面里初始化该池子');
        } else {
          return toast.error(`❌ 池子状态异常: ${poolStatus.message}`);
        }
      }

      const pool = getPoolContract(provider, poolAddr);
      const [t0, t1] = await Promise.all([pool.token0(), pool.token1()]);
      const tokenInAddr = tokenA.toLowerCase();
      const zeroForOne = tokenInAddr === t0.toLowerCase() ? true : tokenInAddr === t1.toLowerCase() ? false : null;

      if (zeroForOne === null) throw new Error('Token 与池子不匹配');

      let decimals = 18;
      const tokenMeta = findTokenByAddress(tokenInAddr);
      decimals = tokenMeta?.decimalsHint || (await getTokenInfo(provider, tokenInAddr)).decimals;
      const amountIn = ethers.parseUnits(payAmount, Number(decimals));

      const est = await estimateSwapOut(provider, poolAddr, zeroForOne, amountIn);

      let outDecimals = 18;
      const outMeta = findTokenByAddress(est.tokenOut);
      outDecimals = outMeta?.decimalsHint || (await getTokenInfo(provider, est.tokenOut)).decimals;
      const estOutHuman = ethers.formatUnits(est.amountOut, Number(outDecimals));
      
      const slipNum = Number(slippagePct || '0');
      const minOut = (est.amountOut * BigInt(Math.round((100 - slipNum) * 100))) / 10000n;
      const minOutHuman = ethers.formatUnits(minOut, Number(outDecimals));

      setEstOutInfo({
        amountOut: est.amountOut,
        estOutHuman,
        tokenOutSymbol: outMeta?.symbol || 'TokenB',
        tokenInSymbol: tokenMeta?.symbol || 'TokenA',
        minOutHuman,
        priceStr: `1 ${tokenMeta?.symbol} ≈ ${(Number(estOutHuman)/Number(payAmount)).toFixed(4)} ${outMeta?.symbol}`,
        slippage: slipNum
      });

      setPendingTxArgs({ poolAddr, zeroForOne, amountIn });
      
      toast.dismiss(toastId);
      setSwapping(false);
      setIsConfirmOpen(true); 

    } catch (err) {
      toast.dismiss(toastId);
      setSwapping(false);
      console.error('交换计算错误:', err);
      
      // 提供更详细的错误提示
      let errorMsg = err.message;
      if (errorMsg.includes('未初始化')) {
        errorMsg = `❌ 池子 ${selectedPool?.token0Meta?.symbol}/${selectedPool?.token1Meta?.symbol} 未初始化\n\n` +
                   `请在"🚀 部署"页面中初始化该池子。`;
      } else if (errorMsg.includes('无流动性')) {
        errorMsg = `❌ 池子 ${selectedPool?.token0Meta?.symbol}/${selectedPool?.token1Meta?.symbol} 无流动性\n\n` +
                   `请在"💧 流动性管理"页面中添加流动性。`;
      } else if (errorMsg.includes('reverted')) {
        errorMsg = `❌ 池子调用失败\n可能原因：未初始化或无流动性\n\n` +
                   `请检查：\n1️⃣ 池子是否初始化\n2️⃣ 是否有足够的流动性`;
      }
      
      toast.error(errorMsg);
    }
  };

  // --- Swap 执行 ---
  const executeSwap = async () => {
    if (!pendingTxArgs) return;
    setIsConfirmOpen(false);

    const swapPromise = (async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const res = await swapExactIn(provider, signer, pendingTxArgs.poolAddr, pendingTxArgs.zeroForOne, pendingTxArgs.amountIn);
        return res.tx.hash;
      } catch (err) {
        // 根据错误类型提供更好的错误消息
        console.error('交换执行错误:', err);
        let detailedError = err.message;
        
        if (err.message.includes('未初始化')) {
          detailedError = '池子未初始化。请在部署页面初始化该池子后再尝试交换';
        } else if (err.message.includes('无流动性')) {
          detailedError = '池子无流动性。请先添加流动性后再尝试交换';
        } else if (err.message.includes('reverted') || err.message.includes('execution reverted')) {
          detailedError = '交换执行失败（合约 revert）。可能原因：\n1. 池子未初始化\n2. 流动性不足\n3. 滑点超过保护值';
        } else if (err.message.includes('价格滑点超限')) {
          detailedError = '滑点超过保护值。可以增大滑点容限后重试';
        }
        
        throw new Error(detailedError);
      }
    })();

      toast.promise(swapPromise, {
        loading: '正在提交交易...',
        success: (hash) => `交易已发送! Hash: ${hash.substring(0,8)}...`,
        error: (err) => {
          let msg = err.message || String(err);
          
          // 改进错误提示
          if (msg.includes('无流动性')) {
            msg = `❌ 池子无流动性！\n\n` +
                  `当前池子: ${selectedPool?.token0Meta?.symbol}/${selectedPool?.token1Meta?.symbol}\n` +
                  `需要先在流动性管理页面添加流动性。`;
          } else if (msg.includes('未初始化')) {
            msg = `❌ 池子未初始化！\n\n需要在部署页面初始化该池子。`;
          }
          
          return msg;
        }
      });
  };

  return (
    <div className="container">
      <h2>💱 代币兑换 (AMM)</h2>
      
      <p style={{color: '#888', marginBottom: '20px'}}>
        基于创新曲线设计的自动做市商兑换。
      </p>

      {/* 池子选择区域 - 强调重要性 */}
      <div style={{
        padding: '15px',
        backgroundColor: selectedPool ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 159, 64, 0.15)',
        border: `2px solid ${selectedPool ? '#4ade80' : '#ff9f40'}`,
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{flex: 1}}>
            <div style={{fontSize: '0.85rem', color: '#aaa', marginBottom: '5px'}}>📍 当前交易对：</div>
            {selectedPool ? (
              <div style={{fontSize: '1.1rem', fontWeight: 'bold', color: selectedPool ? '#4ade80' : '#ff9f40'}}>
                {selectedPool.token0Meta?.symbol}/{selectedPool.token1Meta?.symbol} 
                <span style={{fontSize: '0.85rem', color: '#888', marginLeft: '8px'}}>Fee: {selectedPool.fee}</span>
              </div>
            ) : (
              <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#ff9f40'}}>❌ 未选择 - 请先选择交易对</div>
            )}
            {selectedPool && (
              <div style={{fontSize: '0.75rem', color: '#666', marginTop: '4px'}}>
                {selectedPool.address.slice(0,6)}...{selectedPool.address.slice(-4)}
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsPoolModalOpen(true)}
            style={{
              padding: '10px 16px',
              background: selectedPool ? '#4ade80' : '#ff9f40',
              border: 'none',
              borderRadius: '6px',
              color: selectedPool ? 'black' : 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              whiteSpace: 'nowrap'
            }}
          >
            🔄 {selectedPool ? '切换' : '选择'}交易对
          </button>
        </div>
      </div>

      {/* 查看已有交易对按钮 */}
      <div style={{marginBottom:'20px'}}>
        <button 
          onClick={() => setIsPoolModalOpen(true)}
          style={{
            padding: '10px 16px',
            background: '#333',
            border: '1px solid #555',
            borderRadius: '4px',
            color: '#aaa',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="查看已有的交易对"
        >
          <Eye size={16} /> 查看已有交易对 ({poolList.length})
        </button>
      </div>
      
      {/* UI 输入部分 */}
      <div className="input-group">
        <label>支付 (Token A)</label>
        <div style={{display: 'flex', gap: '10px'}}>
          <input type="number" placeholder="0.0" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
          <select style={{width: '120px'}} value={tokenAChoice} onChange={e=>setTokenAChoice(e.target.value)}>
            {tokenList.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
            <option value="custom">自定义</option>
          </select>
        </div>
        {tokenAChoice === 'custom' && <input style={{marginTop: 6}} placeholder="0x..." value={tokenACustom} onChange={e => setTokenACustom(e.target.value)} />}
      </div>

      <div className="input-group">
        <label>接收 (Token B)</label>
        <div style={{display: 'flex', gap: '10px'}}>
          <input type="number" placeholder="自动计算" disabled value={estOutInfo ? estOutInfo.estOutHuman : ''} />
          <select style={{width: '120px'}} value={tokenBChoice} onChange={e=>setTokenBChoice(e.target.value)}>
            {tokenList.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
            <option value="custom">自定义</option>
          </select>
        </div>
        {tokenBChoice === 'custom' && <input style={{marginTop: 6}} placeholder="0x..." value={tokenBCustom} onChange={e => setTokenBCustom(e.target.value)} />}
      </div>

      <div className="input-group">
        <label>最大滑点 (%)</label>
        <input type="number" value={slippagePct} onChange={e => setSlippagePct(e.target.value)} step="0.1" />
      </div>
      
      <div className="data-card">
         <div style={{display: 'flex', justifyContent: 'space-between'}}>
           <span>预估价格</span>
           <span>{estOutInfo ? estOutInfo.priceStr : '--'}</span>
         </div>
      </div>

      <button className="action-btn" onClick={handleSwapCheck} disabled={swapping}>
        {swapping ? '计算中...' : '立即兑换'}
      </button>

      {/* 调试工具栏（已移除查找池子/创建池子功能，仅保留查询 Slot0） */}
      <div style={{marginTop: 20, borderTop: '1px solid #333', paddingTop: 10}}>
         <h4 style={{margin: '0 0 10px 0', color: '#666'}}>开发调试工具</h4>
         <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
            <button onClick={handleQuerySlot0} style={{padding: '5px 10px', background: 'transparent', border: '1px solid #555', color: '#aaa', cursor:'pointer'}}>
              查询 Slot0
            </button>
         </div>
      </div>

      {/* 兑换确认模态框 */}
      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} title="确认兑换详情">
        {estOutInfo && (
          <div>
             <div className="data-card" style={{marginTop:0, border:'1px solid #444'}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span>支付</span>
                  <b>{payAmount} {estOutInfo.tokenInSymbol}</b>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', marginTop:10}}>
                  <span>接收 (预估)</span>
                  <b>{estOutInfo.estOutHuman} {estOutInfo.tokenOutSymbol}</b>
                </div>
             </div>
             <p style={{fontSize:'0.8rem', color:'#aaa', marginTop:10}}>
               滑点保护 ({estOutInfo.slippage}%)<br/>
               至少接收: {estOutInfo.minOutHuman} {estOutInfo.tokenOutSymbol}
             </p>
             <button className="action-btn" onClick={executeSwap}>确认并在钱包签名</button>
          </div>
        )}
      </Modal>

      {/* 已有交易对模态框 */}
      {isPoolModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            border: '1px solid #333',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto',
            padding: '20px',
            width: '90%'
          }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
              <h3 style={{margin:0}}>已有的交易对</h3>
              <button 
                onClick={() => setIsPoolModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '24px'
                }}
              >
                <X size={24} />
              </button>
            </div>

            {poolList.length === 0 ? (
              <div style={{textAlign:'center', color:'#888', padding:'40px 20px'}}>
                <p>暂无已创建的交易对</p>
                <p style={{fontSize:'0.9rem'}}>请前往部署页面创建交易对。</p>
              </div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                {poolList.map((pool, idx) => (
                  <div key={pool.address} style={{
                    padding: '15px',
                    backgroundColor: selectedPool?.address === pool.address ? '#1a3a1a' : '#222',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${selectedPool?.address === pool.address ? '#4ade80' : '#646cff'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    opacity: selectedPool?.address === pool.address ? 1 : 0.8
                  }}
                  onClick={() => {
                    setSelectedPool(pool);
                    setIsPoolModalOpen(false);
                    toast.success(`✅ 已选择: ${pool.token0Meta?.symbol}/${pool.token1Meta?.symbol}`);
                  }}>
                    <div style={{marginBottom:'8px', display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                      <div>
                        <div style={{fontSize:'0.9rem', fontWeight:'bold', color:'#fff'}}>
                          #{idx + 1} {pool.token0Meta?.symbol}/{pool.token1Meta?.symbol} (Fee: {pool.fee})
                        </div>
                        <div style={{fontSize:'0.75rem', color:'#888', marginTop:'4px'}}>
                          {pool.isInitialized ? '✅ 已初始化' : '⚠️ 未初始化'}
                        </div>
                      </div>
                      {selectedPool?.address === pool.address && (
                        <div style={{fontSize: '1.2rem'}}>✓</div>
                      )}
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      gap: '8px',
                      alignItems: 'center',
                      fontSize: '0.8rem'
                    }}>
                      <span style={{color:'#aaa'}}>地址:</span>
                      <code style={{color:'#4ade80', wordBreak:'break-all'}}>{pool.address}</code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(pool.address);
                          toast.success('已复制');
                        }}
                        style={{padding:'4px 8px', background:'#333', border:'none', borderRadius:'4px', cursor:'pointer'}}
                      >
                        <Copy size={14}/>
                      </button>
                    </div>
                    {pool.sqrtPriceX96 && (
                      <div style={{marginTop:'8px', fontSize:'0.8rem', color:'#888'}}>
                        SqrtPrice: {pool.sqrtPriceX96}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SwapPage;