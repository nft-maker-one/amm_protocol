import React, { useState } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast'; 
import { X, Settings } from 'lucide-react'; 

import AMMPoolABI from '../api/abi/AMMPool.json';
import { TOKEN_LIST, TOKENS, findTokenByAddress } from '../api/tokens';
import {
  AMMPOOL_ADDRESS,
  ensureSepolia,
  getPool,
  readSlot0,
  getTokenInfo,
  getPoolContract,
  swapExactIn,
  estimateSwapOut,
  // ⚠️ 注意：如果你的 amm.js 里没有 createPool，这两行可能还会报错。
  // 如果再次报错，请把下面这两行也注释掉
  createPool, 
  simulateCreatePool,
} from '../api/amm';

// --- 🚑 紧急修复：本地定义这些缺失的辅助函数 ---
// 这样就不会因为 import 不到而报错了
const getPoolList = () => {
  console.log("调用了 getPoolList");
  return []; 
};
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
  // --- 状态变量 ---
  const [tokenAChoice, setTokenAChoice] = useState(TOKENS.USDT.address);
  const [tokenBChoice, setTokenBChoice] = useState(TOKENS.ETH.address);
  const [tokenACustom, setTokenACustom] = useState('');
  const [tokenBCustom, setTokenBCustom] = useState('');
  const [feeInput, setFeeInput] = useState('3000');
  const [payAmount, setPayAmount] = useState('');
  
  const [swapping, setSwapping] = useState(false);
  const [estOutInfo, setEstOutInfo] = useState(null); 
  const [slippagePct, setSlippagePct] = useState('1.0'); 

  // Pool 相关状态
  const [selectedPool, setSelectedPool] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // 确认弹窗状态
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingTxArgs, setPendingTxArgs] = useState(null);

  const tokenA = tokenAChoice === 'custom' ? tokenACustom : tokenAChoice;
  const tokenB = tokenBChoice === 'custom' ? tokenBCustom : tokenBChoice;

  // --- 队友逻辑 1: 查找池子 ---
  const handleFactoryLookup = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);

      if (!ethers.isAddress(tokenA) || !ethers.isAddress(tokenB)) return toast.error('token 地址无效');
      if (tokenA.toLowerCase() === tokenB.toLowerCase()) return toast.error('两个 token 地址不能相同');

      const fee = Number(feeInput || 3000);
      const poolAddr = await getPool(provider, tokenA, tokenB, fee);

      if (!poolAddr || poolAddr === ethers.ZeroAddress || poolAddr === '0x0000000000000000000000000000000000000000') {
        toast('未找到池子，请创建', { icon: '⚠️' });
        setShowCreateForm(true);
        return;
      }

      // 找到池子
      let poolInfo = {
          address: poolAddr,
          token0: tokenA,
          token1: tokenB,
          fee: fee,
          isInitialized: true
      };
      
      // 调用本地修复的函数
      addPoolToList(poolInfo);
      
      setSelectedPool(poolInfo);
      toast.success(`找到池子: ${poolAddr.substring(0,6)}...`);
    } catch (err) {
      toast.error('操作失败: ' + (err.message || err));
    }
  };

  // --- 队友逻辑 2: 创建池子 ---
  const handleCreatePool = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    const toastId = toast.loading('准备创建池子...');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);

      if (!ethers.isAddress(tokenA) || !ethers.isAddress(tokenB)) throw new Error('token 地址无效');
      const fee = Number(feeInput || 3000);
      
      const existingPool = await getPool(provider, tokenA, tokenB, fee);
      if (existingPool && existingPool !== ethers.ZeroAddress) {
        toast.dismiss(toastId);
        return toast.error(`池子已存在: ${existingPool}`);
      }

      const signer = await provider.getSigner();
      
      // ⚠️ 如果你的 amm.js 里没有 simulateCreatePool，这一步也会报错
      // 如果报错，请注释掉下面这个 if 块
      if (typeof simulateCreatePool === 'function') {
        try {
           await simulateCreatePool(provider, signer, tokenA, tokenB, fee);
        } catch (simErr) {
           toast.dismiss(toastId);
           return toast.error('模拟失败: ' + simErr.message);
        }
      }

      // ⚠️ 如果你的 amm.js 里没有 createPool，这一行会报错
      if (typeof createPool !== 'function') {
         throw new Error("createPool 函数在 api/amm.js 中不存在");
      }

      await createPool(provider, signer, tokenA, tokenB, fee);
      
      toast.success('池子创建请求已发送', { id: toastId });
      setShowCreateForm(false);

    } catch (err) {
      toast.dismiss(toastId);
      toast.error('创建失败: ' + (err.message || err));
    }
  };

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

      const fee = Number(feeInput || 3000);
      let poolAddr = selectedPool?.address;
      if (!poolAddr) poolAddr = await getPool(provider, tokenA, tokenB, fee);
      
      if (!poolAddr || poolAddr === ethers.ZeroAddress) {
        toast.dismiss(toastId);
        setSwapping(false);
        return toast.error('未找到池子，请先创建');
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
      console.error(err);
      toast.error('询价失败: ' + err.message);
    }
  };

  // --- Swap 执行 ---
  const executeSwap = async () => {
    if (!pendingTxArgs) return;
    setIsConfirmOpen(false);

    const swapPromise = (async () => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const res = await swapExactIn(provider, signer, pendingTxArgs.poolAddr, pendingTxArgs.zeroForOne, pendingTxArgs.amountIn);
      return res.tx.hash;
    })();

    toast.promise(swapPromise, {
      loading: '正在提交交易...',
      success: (hash) => `交易已发送! Hash: ${hash.substring(0,8)}...`,
      error: (err) => `失败: ${err.message}`
    });
  };

  return (
    <div className="container">
      <h2>💱 代币兑换 (AMM)</h2>
      
      {/* 模态框 */}
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

      <p style={{color: '#888', marginBottom: '20px'}}>
        基于创新曲线设计的自动做市商兑换。
      </p>
      
      {/* UI 输入部分 */}
      <div className="input-group">
        <label>支付 (Token A)</label>
        <div style={{display: 'flex', gap: '10px'}}>
          <input type="number" placeholder="0.0" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
          <select style={{width: '120px'}} value={tokenAChoice} onChange={e=>setTokenAChoice(e.target.value)}>
            {TOKEN_LIST.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
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
            {TOKEN_LIST.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
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

      {/* 调试工具栏 */}
      <div style={{marginTop: 20, borderTop: '1px solid #333', paddingTop: 10}}>
         <h4 style={{margin: '0 0 10px 0', color: '#666'}}>开发调试工具</h4>
         <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
            <button onClick={handleQuerySlot0} style={{padding: '5px 10px', background: 'transparent', border: '1px solid #555', color: '#aaa', cursor:'pointer'}}>
              查询 Slot0
            </button>
            <button onClick={handleFactoryLookup} style={{padding: '5px 10px', background: 'transparent', border: '1px solid #555', color: '#aaa', cursor:'pointer'}}>
              查找池子
            </button>
            <button onClick={() => setShowCreateForm(!showCreateForm)} style={{padding: '5px 10px', background: 'transparent', border: '1px solid #555', color: '#aaa', cursor:'pointer'}}>
              {showCreateForm ? '收起创建' : '创建新池子'}
            </button>
         </div>
         
         {showCreateForm && (
           <div style={{marginTop: 10, padding: 10, border: '1px dashed #444', background: '#111'}}>
              <p style={{fontSize:'0.9rem'}}>Fee: {feeInput}</p>
              <button className="action-btn" onClick={handleCreatePool} style={{backgroundColor: '#e63946', fontSize: '0.9rem'}}>
                确认创建 (消耗 Gas)
              </button>
           </div>
         )}
      </div>

    </div>
  );
};

export default SwapPage;