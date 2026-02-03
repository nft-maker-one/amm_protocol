import React, { useState } from 'react';
import { ethers } from 'ethers';
import AMMPoolABI from '../api/abi/AMMPool.json';
import { TOKEN_LIST, TOKENS, findTokenByAddress } from '../api/tokens';
import {
  AMMPOOL_ADDRESS,
  AMMFACTORY_ADDRESS,
  ensureSepolia,
  getPool,
  readSlot0,
  getTokenInfo,
  getPoolContract,
  swapExactIn,
  estimateSwapOut,
} from '../api/amm';


// Helper: safely call a view function and decode result, returns decoded result or throws
async function safeCallView(provider, address, abi, fnName, args = []) {
  const iface = new ethers.Interface(abi);
  const data = iface.encodeFunctionData(fnName, args);
  const res = await provider.call({ to: address, data });
  if (!res || res === '0x') throw new Error(`${fnName} 返回空数据，函数可能在该合约上不存在或地址不正确`);
  return iface.decodeFunctionResult(fnName, res);
}

const SwapPage = () => {
  // Default to user's common pair: USDT / ETH
  const [tokenAChoice, setTokenAChoice] = useState(TOKENS.USDT.address);
  const [tokenBChoice, setTokenBChoice] = useState(TOKENS.ETH.address);
  const [tokenACustom, setTokenACustom] = useState('');
  const [tokenBCustom, setTokenBCustom] = useState('');
  const [feeInput, setFeeInput] = useState('3000');
  const [payAmount, setPayAmount] = useState('');
  const [swapping, setSwapping] = useState(false);
  const [estOutInfo, setEstOutInfo] = useState(null); // { amountOut, estOutHuman, tokenOutSymbol, minOutHuman }
  const [slippagePct, setSlippagePct] = useState('1.0'); // percent

  // Pool selection states
  const [selectedPool, setSelectedPool] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [slot0Data, setSlot0Data] = useState(null);

  const tokenA = tokenAChoice === 'custom' ? tokenACustom : tokenAChoice;
  const tokenB = tokenBChoice === 'custom' ? tokenBCustom : tokenBChoice;

  // 通过工厂查找池子
  const handleFactoryLookup = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);

      if (!ethers.isAddress(tokenA) || !ethers.isAddress(tokenB)) return alert('token 地址无效');
      if (tokenA.toLowerCase() === tokenB.toLowerCase()) return alert('两个 token 地址不能相同');

      const fee = Number(feeInput || 3000);
      const poolAddr = await getPool(provider, tokenA, tokenB, fee);

      if (!poolAddr || poolAddr === ethers.ZeroAddress || poolAddr === '0x0000000000000000000000000000000000000000') {
        alert(`未找到池子 (fee=${fee})\n请使用"创建新池子"功能创建`);
        setShowCreateForm(true);
        return;
      }

      // 找到池子，检查是否在列表中
      const poolList = getPoolList();
      let poolInfo = poolList.find(p => p.address.toLowerCase() === poolAddr.toLowerCase());
      
      if (!poolInfo) {
        // 添加到列表
        const tokenAMeta = findTokenByAddress(tokenA);
        const tokenBMeta = findTokenByAddress(tokenB);
        poolInfo = {
          address: poolAddr,
          token0: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenA : tokenB,
          token1: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenB : tokenA,
          token0Meta: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenAMeta : tokenBMeta,
          token1Meta: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenBMeta : tokenAMeta,
          fee: fee,
          isInitialized: false
        };
        
        try {
          const decoded2 = await safeCallView(provider, poolAddr, AMMPoolABI, 'slot0');
          poolInfo.isInitialized = true;
          poolInfo.sqrtPriceX96 = decoded2[0].toString();
          poolInfo.currentTick = decoded2[1].toString();
        } catch (err) {
          console.warn('读取slot0失败，池子可能未初始化');
        }
        
        addPoolToList(poolInfo);
      }
      
      setSelectedPool(poolInfo);
      alert(`找到池子: ${poolAddr}\n已添加到池子列表`);
    } catch (err) {
      alert('操作失败: ' + (err.message || err));
    }
  };

  // 独立的创建池子功能
  const handleCreatePool = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);

      if (!ethers.isAddress(tokenA) || !ethers.isAddress(tokenB)) return alert('token 地址无效');
      if (tokenA.toLowerCase() === tokenB.toLowerCase()) return alert('两个 token 地址不能相同');

      const fee = Number(feeInput || 3000);
      
      // 检查是否已经存在
      const existingPool = await getPool(provider, tokenA, tokenB, fee);
      if (existingPool && existingPool !== ethers.ZeroAddress) {
        return alert(`池子已存在: ${existingPool}`);
      }

      const signer = await provider.getSigner();
      
      try {
        await simulateCreatePool(provider, signer, tokenA, tokenB, fee);
      } catch (simErr) {
        const msg = (simErr && simErr.message) ? simErr.message : String(simErr);
        return alert('模拟 createPool 失败（会 revert）：' + msg);
      }

      await createPool(provider, signer, tokenA, tokenB, fee);

      const newPool = await getPool(provider, tokenA, tokenB, fee);
      if (!newPool || newPool === ethers.ZeroAddress) return alert('创建后未返回有效池子地址');

      // 创建成功后添加到池子列表
      const tokenAMeta = findTokenByAddress(tokenA);
      const tokenBMeta = findTokenByAddress(tokenB);
      const poolInfo = {
        address: newPool,
        token0: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenA : tokenB,
        token1: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenB : tokenA,
        token0Meta: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenAMeta : tokenBMeta,
        token1Meta: tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenBMeta : tokenAMeta,
        fee: fee,
        isInitialized: false
      };

      try {
        const decoded = await readSlot0(provider, newPool);
        poolInfo.isInitialized = true;
        poolInfo.sqrtPriceX96 = decoded[0].toString();
        poolInfo.currentTick = decoded[1].toString();
      } catch (err) {
        console.warn('读取slot0失败，池子可能未初始化');
      }

      addPoolToList(poolInfo);
      setSelectedPool(poolInfo);
      setShowCreateForm(false);
      
      alert(`创建成功，pool: ${newPool}\n已添加到池子列表`);
    } catch (err) {
      alert('创建失败: ' + (err.message || err));
    }
  };

  // 独立的读取slot0功能
  const handleReadSlot0 = async () => {
    if (!selectedPool) return alert('请先选择一个池子');
    if (!window.ethereum) return alert('请先连接钱包');
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);

      const decoded = await safeCallView(provider, selectedPool.address, AMMPoolABI, 'slot0');
      
      // 更新池子信息
      const updatedPool = {
        ...selectedPool,
        isInitialized: true,
        sqrtPriceX96: decoded[0].toString(),
        currentTick: decoded[1].toString()
      };
      
      updatePoolInList(selectedPool.address, updatedPool);
      setSelectedPool(updatedPool);
      
      alert(`池子状态更新成功:\n当前 sqrtPriceX96: ${decoded[0]}\n当前 tick: ${decoded[1]}`);
    } catch (err) {
      alert('读取slot0失败: ' + (err.message || err));
    }
  };
  
  // 查询 pool.slot0 的逻辑
  const handleQuerySlot0 = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);

      const decoded = await safeCallView(provider, AMMPOOL_ADDRESS, AMMPoolABI, 'slot0');
      const sqrtPriceX96 = decoded[0];
      const tick = decoded[1];
      return alert(`pool: ${AMMPOOL_ADDRESS}\n当前 sqrtPriceX96: ${sqrtPriceX96}\n当前 tick: ${tick}`);
    } catch (err) {
      alert('查询失败: ' + (err.message || err));
    }
  };

  const handleSwap = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!payAmount || Number(payAmount) <= 0) return alert('请输入要支付的数量');
    
    try {
      setSwapping(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();

      if (!ethers.isAddress(tokenA) || !ethers.isAddress(tokenB)) {
        return alert('token 地址无效');
      }

      const fee = Number(feeInput || 3000);
      const poolAddr = await getPool(provider, tokenA, tokenB, fee);
      if (!poolAddr || poolAddr === ethers.ZeroAddress) {
        return alert('未找到池子，请先通过下方工厂按钮创建池子');
      }

      const pool = getPoolContract(provider, poolAddr);
      const [t0, t1] = await Promise.all([pool.token0(), pool.token1()]);

      // 当前 UI 约定：支付的是 tokenA，接收的是 tokenB
      const tokenInAddr = tokenA.toLowerCase();
      const zeroForOne =
        tokenInAddr === t0.toLowerCase()
          ? true
          : tokenInAddr === t1.toLowerCase()
            ? false
            : null;

        if (zeroForOne === null) {
          return alert('当前选择的 token 与池子的 token0/token1 不匹配，请检查池子与代币地址');
        }

        // 估算 decimals（优先用本地 hint，不行再去链上读）
        let decimals = 18;
        const tokenMeta = findTokenByAddress(tokenInAddr);
        if (tokenMeta?.decimalsHint != null) {
          decimals = tokenMeta.decimalsHint;
        } else {
          const info = await getTokenInfo(provider, tokenInAddr);
          decimals = Number(info.decimals);
        }

        const amountIn = ethers.parseUnits(payAmount, decimals);

        // 先做一次价格预估，用于滑点提示
        const est = await estimateSwapOut(provider, poolAddr, zeroForOne, amountIn);

        // 输出 token 的 decimals 用于展示
        let outDecimals = 18;
        const outMeta = findTokenByAddress(est.tokenOut.toLowerCase());
        if (outMeta?.decimalsHint != null) {
          outDecimals = outMeta.decimalsHint;
        } else {
          const outInfo = await getTokenInfo(provider, est.tokenOut);
          outDecimals = Number(outInfo.decimals);
        }

        const estOutHuman = ethers.formatUnits(est.amountOut, outDecimals);
        const priceStr = `${payAmount} ${tokenMeta?.symbol || tokenInAddr} → 约 ${estOutHuman} ${outMeta?.symbol || est.tokenOut}`;

        // 根据滑点计算"最低接收"
        const slipNum = Number(slippagePct || '0');
        const slipClamped = Math.max(0, Math.min(100, slipNum));
        const bps = Math.round((100 - slipClamped) * 100); // (1 - slip%) * 10000
        const minOut = (est.amountOut * BigInt(bps)) / 10000n;
        const minOutHuman = ethers.formatUnits(minOut, outDecimals);

        setEstOutInfo({
          amountOut: est.amountOut,
          estOutHuman,
          tokenOutSymbol: outMeta?.symbol || est.tokenOut,
          minOutHuman,
          priceStr,
        });

        const ok = window.confirm(
          `价格预估：${priceStr}\n` +
          `滑点 ${slipClamped}% 下的最低接收：${minOutHuman} ${outMeta?.symbol || est.tokenOut}\n\n` +
          `注意：目前滑点只是前端提示，合约 swap 本身没有强制 minAmountOut 保护。\n是否继续提交兑换交易？`
        );
        if (!ok) return;

        const res = await swapExactIn(provider, signer, poolAddr, zeroForOne, amountIn);

        alert(
          `兑换提交成功！\n` +
          `pool: ${poolAddr}\n` +
          `支付 token: ${tokenMeta?.symbol || tokenInAddr}\n` +
          `支付数量(最小单位): ${amountIn.toString()}\n` +
          `交易哈希: ${res.tx.hash}`
        );
      alert('兑换失败: ' + (err.message || err));
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="container">
      <h2>💱 代币兑换 (AMM)</h2>
      <p style={{color: '#888', marginBottom: '20px'}}>
        基于创新曲线设计的自动做市商兑换。
      </p>
      
      <div className="input-group">
        <label>支付 (Token A)</label>
        <div style={{display: 'flex', gap: '10px'}}>
          <input
            type="number"
            placeholder="0.0"
            value={payAmount}
            onChange={e => setPayAmount(e.target.value)}
          />
          <select style={{width: '120px'}} value={tokenAChoice} onChange={e=>setTokenAChoice(e.target.value)}>
            {TOKEN_LIST.map(t => (
              <option key={t.address} value={t.address}>{t.symbol}</option>
            ))}
            <option value="custom">自定义</option>
          </select>
        </div>
        {tokenAChoice === 'custom' && (
          <input
            style={{marginTop: 6}}
            placeholder="TokenA 自定义合约地址 0x..."
            value={tokenACustom}
            onChange={e => setTokenACustom(e.target.value)}
          />
        )}
      </div>

      <div className="input-group">
        <label>接收 (Token B)</label>
        <div style={{display: 'flex', gap: '10px'}}>
          <input type="number" placeholder="0.0" disabled />
          <select style={{width: '120px'}} value={tokenBChoice} onChange={e=>setTokenBChoice(e.target.value)}>
            {TOKEN_LIST.map(t => (
              <option key={t.address} value={t.address}>{t.symbol}</option>
            ))}
            <option value="custom">自定义</option>
          </select>
        </div>
        {tokenBChoice === 'custom' && (
          <input
            style={{marginTop: 6}}
            placeholder="TokenB 自定义合约地址 0x..."
            value={tokenBCustom}
            onChange={e => setTokenBCustom(e.target.value)}
          />
        )}
      </div>

      <div className="data-card">
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          <span>预估价格</span>
          {estOutInfo ? (
            <span style={{textAlign:'right'}}>
              {estOutInfo.priceStr}
              <br />
              <span style={{fontSize:'0.8rem', color:'#888'}}>
                滑点 {slippagePct || '0'}% → 最低接收 {estOutInfo.minOutHuman} {estOutInfo.tokenOutSymbol}
              </span>
            </span>
          ) : (
            <span>将在点击"立即兑换"前自动预估价格与滑点</span>
          )}
        </div>
      </div>

      <div className="input-group">
        <label>最大滑点 (%)</label>
        <input
          type="number"
          value={slippagePct}
          onChange={e => setSlippagePct(e.target.value)}
          placeholder="1.0"
          min="0"
          max="100"
          step="0.1"
        />
      </div>

      <button className="action-btn" onClick={handleSwap} disabled={swapping}>
        {swapping ? '兑换中...' : '立即兑换'}
      </button>
      <button style={{marginLeft: 12}} onClick={handleQuerySlot0}>查询池子价格 (slot0)</button>


    </div>
  );
};

export default SwapPage;