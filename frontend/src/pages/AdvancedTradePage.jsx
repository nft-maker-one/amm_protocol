import React, { useState, useRef } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast'; // 1. 引入 Toast
import { 
  Settings, 
  Route, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Info, 
  ShieldAlert, 
  Search,
  X,
  Copy
} from 'lucide-react'; // 2. 引入图标

import {
  ensureSepolia,
  enableFeeAmount,
  getFactoryOwner,
  getFeeAmountTickSpacing,
  AMMFACTORY_ADDRESS,
  getPoolLiquidity,
  readSlot0,
  estimateSwapOut,
  checkPoolStatus
} from '../api/amm';
import {
  MultiHopRouter,
  COMMON_TOKENS,
  COMMON_FEES,
  COMMON_CHAINS
} from '../api/routing';
import { TOKENS, getTokenList } from '../api/tokens';

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

const AdvancedTradePage = () => {
  // --- 状态管理 ---
  const [tokenList, setTokenList] = useState(getTokenList());
  const [newFee, setNewFee] = useState('');
  const [tickSpacing, setTickSpacing] = useState('');
  const [queryFee, setQueryFee] = useState('3000');
  const [loading, setLoading] = useState(false);
  
  // Owner权限相关
  const [currentUser, setCurrentUser] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerCheckLoading, setOwnerCheckLoading] = useState(false);
  
  // 路由测试状态
  const [selectedChain, setSelectedChain] = useState(11155111); // 默认 Sepolia
  const [routeTokenIn, setRouteTokenIn] = useState('');
  const [routeTokenOut, setRouteTokenOut] = useState('');
  const [routeAmount, setRouteAmount] = useState('');
  const [maxHops, setMaxHops] = useState('3');
  const [slippageTolerance, setSlippageTolerance] = useState('0.5');
  const [routingResult, setRoutingResult] = useState(null);
  const [routingLoading, setRoutingLoading] = useState(false);

  // 池子诊断状态
  const [poolDiagnosis, setPoolDiagnosis] = useState(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);

  // 确认弹窗状态
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  
  // 引用结果区域以便滚动
  const resultRef = useRef(null);

  // --- 1. Factory 管理逻辑 ---

  const handleEnableFeeCheck = () => {
    if (!newFee || !tickSpacing) return toast.error('请输入费率和 tick spacing');
    if (Number.isNaN(Number(newFee)) || Number.isNaN(Number(tickSpacing))) {
      return toast.error('必须是数字');
    }
    setIsFeeModalOpen(true);
  };

  const executeEnableFee = async () => {
    setIsFeeModalOpen(false);
    if (!window.ethereum) return toast.error('请先连接钱包');

    const fee = Number(newFee);
    const spacing = Number(tickSpacing);

    const enablePromise = (async () => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      const tx = await enableFeeAmount(provider, signer, fee, spacing);
      return tx.hash;
    })();

    toast.promise(enablePromise, {
      loading: '正在启用新费率...',
      success: (hash) => `启用成功! Tx: ${hash.substring(0,8)}...`,
      error: (err) => `失败: ${err.message}`
    });
  };

  const handleQueryFeeTickSpacing = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!queryFee) return toast.error('请输入费率');
    const toastId = toast.loading('查询中...');
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      const spacing = await getFeeAmountTickSpacing(provider, Number(queryFee));
      setFeeTickSpacing(spacing);
      
      if (spacing === 0) {
        toast.error(`费率 ${queryFee} 未启用`, { id: toastId });
      } else {
        toast.success(`Spacing: ${spacing}`, { id: toastId });
      }
    } catch (err) {
      toast.error('查询失败: ' + err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Owner 检查逻辑 ---
  const checkOwnerStatus = async () => {
    if (!window.ethereum) return;

    try {
      setOwnerCheckLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      // 不强制 ensureSepolia，以免只是浏览页面就弹窗切换网络
      
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      setCurrentUser(userAddress);
      
      const owner = await getFactoryOwner(provider);
      setFactoryOwner(owner);
      
      const isUserOwner = userAddress.toLowerCase() === owner.toLowerCase();
      setIsOwner(isUserOwner);
      
    } catch (err) {
      console.warn('Check owner failed:', err);
      setIsOwner(false);
    } finally {
      setOwnerCheckLoading(false);
    }
  };

  React.useEffect(() => {
    if (window.ethereum) {
      checkOwnerStatus();
      window.ethereum.on('accountsChanged', checkOwnerStatus);
      return () => {
        window.ethereum.removeListener('accountsChanged', checkOwnerStatus);
      };
    }
  }, []);

  // --- 3. 路由测试逻辑 (核心) ---
  const handleTestAdvancedRouting = async () => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    if (!ethers.isAddress(routeTokenIn) || !ethers.isAddress(routeTokenOut)) {
      return toast.error('代币地址无效');
    }
    if (!routeAmount || parseFloat(routeAmount) <= 0) {
      return toast.error('交易金额无效');
    }

    setRoutingLoading(true);
    setRoutingResult(null);
    const toastId = toast.loading('正在运行高级路由算法...');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);

      const amountIn = ethers.parseEther(routeAmount);
      const maxHopsNum = parseInt(maxHops) || 3;
      const router = new MultiHopRouter(provider, AMMFACTORY_ADDRESS);

      // 阶段1: 路径发现
      const startTime = Date.now();
      const allRoutes = await router.generatePossibleRoutes(routeTokenIn, routeTokenOut, maxHopsNum);
      const discoveryTime = Date.now() - startTime;

      if (allRoutes.length === 0) {
        setRoutingResult({
          success: false,
          stage: 'discovery',
          error: '未发现任何可用路径',
          stats: { discoveryTime, totalRoutes: 0 }
        });
        toast.error('未找到可用路径', { id: toastId });
        return;
      }

      // 阶段2: 报价获取
      const quoteStartTime = Date.now();
      const routeAnalysis = [];
      let bestRoute = null;
      let bestAmountOut = 0n;

      for (let i = 0; i < allRoutes.length; i++) {
        const route = allRoutes[i];
        try {
          // 验证池子流动性
          const poolValidation = [];
          for (let j = 0; j < route.hops; j++) {
            const tokenIn = route.tokens[j];
            const tokenOut = route.tokens[j+1];
            const fee = route.fees[j];
            const poolAddr = await router.getPoolAddress(tokenIn, tokenOut, fee);
            
            const [liquidity, slot0] = await Promise.all([
               getPoolLiquidity(provider, poolAddr),
               readSlot0(provider, poolAddr)
            ]);
            
            if (liquidity === 0n) throw new Error(`Hop ${j+1} 无流动性`);
            
            poolValidation.push({
               hop: j+1,
               poolAddress: poolAddr,
               liquidity: liquidity.toString(),
               currentTick: slot0[1].toString(),
               tokenIn: tokenIn.slice(0,6)+'...',
               tokenOut: tokenOut.slice(0,6)+'...',
               fee
            });
          }
          
          const quote = await router.getRouteQuote(route, amountIn);
          const routeData = {
             index: i + 1,
             path: route.tokens.join(' → '),
             fees: route.fees,
             hops: route.hops,
             amountOut: ethers.formatEther(quote.amountOut),
             priceImpact: quote.priceImpact,
             estimatedGas: quote.gas,
             poolValidation,
             success: true
          };
          
          routeAnalysis.push(routeData);
          if (quote.amountOut > bestAmountOut) {
             bestAmountOut = quote.amountOut;
             bestRoute = { ...route, quote, analysis: routeData };
          }
        } catch (err) {
           routeAnalysis.push({
             index: i + 1,
             path: route.tokens.join(' → '),
             fees: route.fees,
             hops: route.hops,
             error: err.message,
             success: false
           });
        }
      }

      const quoteTime = Date.now() - quoteStartTime;

      // 阶段3: 执行模拟
      let simulationResult = null;
      if (bestRoute) {
        try {
           let currentAmount = amountIn;
           const simulationSteps = [];
           for(let i=0; i<bestRoute.hops; i++) {
              const tokenIn = bestRoute.tokens[i];
              const tokenOut = bestRoute.tokens[i+1];
              const fee = bestRoute.fees[i];
              const poolAddr = await router.getPoolAddress(tokenIn, tokenOut, fee);
              const zeroForOne = tokenIn.toLowerCase() < tokenOut.toLowerCase();
              
              const stepQuote = await estimateSwapOut(provider, poolAddr, zeroForOne, currentAmount);
              
              simulationSteps.push({
                 step: i+1,
                 tokenIn: tokenIn.slice(0,6)+'...',
                 tokenOut: tokenOut.slice(0,6)+'...',
                 amountIn: ethers.formatEther(currentAmount),
                 amountOut: ethers.formatEther(stepQuote.amountOut),
                 fee
              });
              currentAmount = stepQuote.amountOut;
           }
           simulationResult = {
              success: true,
              steps: simulationSteps,
              finalAmountOut: ethers.formatEther(currentAmount)
           };
        } catch(err) {
           simulationResult = { success: false, error: err.message };
        }
      }

      const totalTime = Date.now() - startTime;
      const successfulRoutes = routeAnalysis.filter(r => r.success);

      const result = {
         success: !!bestRoute,
         bestRoute: bestRoute ? {
            path: bestRoute.tokens.join(' → '),
            hops: bestRoute.hops,
            fees: bestRoute.fees,
            amountOut: ethers.formatEther(bestAmountOut),
            priceImpact: bestRoute.quote.priceImpact,
            estimatedGas: bestRoute.quote.gas
         } : null,
         allRoutes: routeAnalysis,
         simulation: simulationResult,
         stats: {
            totalTime, discoveryTime, quoteTime,
            totalRoutes: allRoutes.length,
            successfulRoutes: successfulRoutes.length
         }
      };

      setRoutingResult(result);
      
      if (result.success) {
        toast.success(`测试完成: 找到 ${successfulRoutes.length} 条路径`, { id: toastId });
        // 自动滚动到结果区域
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        toast.error('测试失败: 所有路径均无效', { id: toastId });
      }

    } catch (err) {
      console.error(err);
      toast.error('路由报错: ' + err.message, { id: toastId });
      setRoutingResult({ success: false, error: err.message });
    } finally {
      setRoutingLoading(false);
    }
  };

  const handleQuickRouteTest = (tokenIn, tokenOut, amount) => {
    setRouteTokenIn(tokenIn);
    setRouteTokenOut(tokenOut);
    setRouteAmount(amount);
    toast('参数已填入，请点击开始测试', { icon: '📝' });
  };

  // 诊断池子状态
  const handleDiagnosePool = async (poolAddress) => {
    if (!window.ethereum) return toast.error('请先连接钱包');
    
    const toastId = toast.loading('正在诊断池子状态...');
    try {
      setDiagnosisLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      const status = await checkPoolStatus(provider, poolAddress);
      setPoolDiagnosis(status);
      
      if (status.status === 'INITIALIZED') {
        toast.success('✅ 池子已初始化', { id: toastId });
      } else if (status.status === 'NOT_INITIALIZED') {
        toast.error('❌ 池子未初始化 (需要调用 initialize)', { id: toastId });
      } else {
        toast.error(`❌ 池子状态异常: ${status.status}`, { id: toastId });
      }
    } catch (err) {
      toast.error('诊断失败: ' + err.message, { id: toastId });
    } finally {
      setDiagnosisLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>🚀 高级路由与设置</h2>
      
      {/* 模态框: 启用费率确认 */}
      <Modal isOpen={isFeeModalOpen} onClose={() => setIsFeeModalOpen(false)} title="确认启用新费率">
        <div style={{textAlign: 'left'}}>
          <div className="data-card" style={{marginTop: 0}}>
            <p><strong>费率 (Fee):</strong> {newFee} ({(Number(newFee)/10000).toFixed(2)}%)</p>
            <p><strong>Tick Spacing:</strong> {tickSpacing}</p>
          </div>
          <div style={{fontSize: '0.85rem', color: '#e63946', margin: '15px 0'}}>
            <p style={{display:'flex', alignItems:'center', gap: 5}}>
              <ShieldAlert size={16}/> 仅 Factory Owner 可执行
            </p>
          </div>
          <button className="action-btn" onClick={executeEnableFee}>确认并在钱包签名</button>
        </div>
      </Modal>

      {/* 1. 常规设置区域 */}
      <div className="input-group">
        <label>路由目标链</label>
        <select 
          value={selectedChain}
          onChange={e => setSelectedChain(Number(e.target.value))}
        >
          {COMMON_CHAINS.map(chain => (
            <option key={chain.id} value={chain.id}>
              {chain.name} {chain.isTestnet ? '(Testnet)' : ''}
            </option>
          ))}
        </select>
        <small style={{color: '#666', marginTop: '5px', display: 'block'}}>
           ✓ 默认支持 Sepolia Ethereum 测试网
        </small>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
         <div className="input-group">
            <label>最大滑点保护 (%)</label>
            <input 
              type="number" 
              value={slippageTolerance} 
              onChange={e => setSlippageTolerance(e.target.value)}
              step="0.1" min="0.1" max="50"
            />
         </div>
         <div className="input-group">
            <label>交易截止 (分钟)</label>
            <input type="number" defaultValue="20" />
         </div>
      </div>
      
      <button className="action-btn" onClick={() => toast.success("设置已保存 (本地)")}>
         保存偏好设置
      </button>

      {/* 2. 路由测试区域 */}
      <div className="data-card" style={{marginTop: 30}}>
        <h3 style={{display:'flex', alignItems:'center', gap: 8}}><Route size={20}/> 高级多跳路由测试</h3>
        <p style={{color: '#888', marginBottom: '20px', fontSize: '0.9rem'}}>
          验证多跳路由算法：路径发现 &rarr; 链上询价 &rarr; 最优选择 &rarr; 模拟执行
        </p>

        {/* 自定义测试表单 */}
        <div style={{background: '#151515', padding: 15, borderRadius: 8}}>
            <div className="input-group">
              <label>输入代币</label>
              <select 
                value={routeTokenIn} 
                onChange={e => setRouteTokenIn(e.target.value)}
                style={{marginBottom: '10px', width: '100%', padding: '10px', fontSize: '0.95rem'}}
              >
                <option value="">-- 选择代币 --</option>
                {tokenList.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.symbol} {token.isCustom ? '(Custom)' : ''}
                  </option>
                ))}
              </select>
              {routeTokenIn && (
                <div style={{display:'flex', alignItems:'center', gap:10, padding:'10px', background:'#222', borderRadius:'4px', marginBottom:'10px', fontSize:'0.85rem'}}>
                  <div style={{flex:1, fontFamily:'monospace', wordBreak:'break-all', color:'#aaa'}}>
                    {routeTokenIn}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(routeTokenIn);
                      toast.success('已复制');
                    }}
                    style={{padding:'4px 8px', background:'#333', border:'none', borderRadius:'3px', cursor:'pointer', fontSize:'0.8rem'}}
                  >
                    <Copy size={14}/>
                  </button>
                </div>
              )}
            </div>
            <div className="input-group">
              <label>输出代币</label>
              <select 
                value={routeTokenOut} 
                onChange={e => setRouteTokenOut(e.target.value)}
                style={{marginBottom: '10px', width: '100%', padding: '10px', fontSize: '0.95rem'}}
              >
                <option value="">-- 选择代币 --</option>
                {tokenList.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.symbol} {token.isCustom ? '(Custom)' : ''}
                  </option>
                ))}
              </select>
              {routeTokenOut && (
                <div style={{display:'flex', alignItems:'center', gap:10, padding:'10px', background:'#222', borderRadius:'4px', marginBottom:'10px', fontSize:'0.85rem'}}>
                  <div style={{flex:1, fontFamily:'monospace', wordBreak:'break-all', color:'#aaa'}}>
                    {routeTokenOut}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(routeTokenOut);
                      toast.success('已复制');
                    }}
                    style={{padding:'4px 8px', background:'#333', border:'none', borderRadius:'3px', cursor:'pointer', fontSize:'0.8rem'}}
                  >
                    <Copy size={14}/>
                  </button>
                </div>
              )}
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
                <div className="input-group">
                    <label>金额</label>
                    <input type="number" value={routeAmount} onChange={e => setRouteAmount(e.target.value)} placeholder="1.0" />
                </div>
                <div className="input-group">
                    <label>最大跳数</label>
                    <select value={maxHops} onChange={e => setMaxHops(e.target.value)}>
                        <option value="1">1 Hop (Direct)</option>
                        <option value="2">2 Hops</option>
                        <option value="3">3 Hops</option>
                        <option value="4">4 Hops</option>
                    </select>
                </div>
            </div>
            <button 
              className="action-btn" 
              onClick={handleTestAdvancedRouting} 
              disabled={routingLoading}
              style={{marginTop: 10, background: '#2e7d32'}}
            >
              {routingLoading ? '计算中...' : '🚀 开始路由计算'}
            </button>
        </div>

        {/* 3. 路由结果展示区 */}
        <div ref={resultRef}>
        {routingResult && (
          <div style={{marginTop: '20px', padding: '15px', backgroundColor: routingResult.success ? '#1a2f1a' : '#2f1a1a', borderRadius: '8px', border: routingResult.success ? '1px solid #2e7d32' : '1px solid #c62828'}}>
            <h4 style={{margin: '0 0 15px 0', color: routingResult.success ? '#4CAF50' : '#f44336', display: 'flex', alignItems:'center', gap: 8}}>
              {routingResult.success ? <CheckCircle size={18}/> : <XCircle size={18}/>}
              {routingResult.success ? '路由计算完成' : '路由计算失败'}
            </h4>

            {/* 最佳路径 */}
            {routingResult.bestRoute && (
              <div style={{marginBottom: '15px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px'}}>
                <h5 style={{margin: '0 0 10px 0', color: '#4ade80'}}>🏆 最佳路径</h5>
                <div style={{fontSize: '0.9rem', lineHeight: '1.6'}}>
                  <div><strong>Path:</strong> {routingResult.bestRoute.path}</div>
                  <div><strong>Output:</strong> {Number(routingResult.bestRoute.amountOut).toFixed(6)} tokens</div>
                  <div><strong>Gas est:</strong> {routingResult.bestRoute.estimatedGas?.toLocaleString()}</div>
                </div>
              </div>
            )}
            
            {/* 所有路由的详细分析 */}
            {routingResult.allRoutes && routingResult.allRoutes.length > 0 && (
              <div style={{marginBottom: '15px', marginTop: '15px'}}>
                <h5 style={{margin: '0 0 10px 0', color: '#FFA726'}}>📊 所有路由分析</h5>
                <div style={{maxHeight: '400px', overflowY: 'auto', borderTop: '1px solid #444', paddingTop: '10px'}}>
                  {routingResult.allRoutes.map((route, idx) => (
                    <div key={idx} style={{marginBottom: '12px', padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px', border: route.success ? '1px solid #2e7d32' : '1px solid #c62828'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                        <span style={{fontSize: '0.85rem', fontWeight: 'bold'}}>
                          路径 #{route.index}: {route.path}
                        </span>
                        <span style={{fontSize: '0.75rem', background: route.success ? '#1a3a1a' : '#3a1a1a', color: route.success ? '#4ade80' : '#f44336', padding: '2px 6px', borderRadius: '3px'}}>
                          {route.success ? '✅ 有效' : '❌ 无效'}
                        </span>
                      </div>
                      
                      {route.success ? (
                        <div style={{fontSize: '0.8rem', color: '#aaa', lineHeight: '1.5'}}>
                          <div>💰 输出: {Number(route.amountOut).toFixed(6)} tokens</div>
                          <div>⛽ 预估Gas: {route.estimatedGas?.toLocaleString() || 'N/A'}</div>
                          <div>📈 价格影响: {route.priceImpact?.toFixed(2)}%</div>
                          {route.poolValidation && route.poolValidation.length > 0 && (
                            <div style={{marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #444'}}>
                              {route.poolValidation.map((pool, pidx) => (
                                <div key={pidx} style={{fontSize: '0.75rem', color: '#999', marginBottom: '4px'}}>
                                  <span>Hop {pool.hop}: {pool.tokenIn} → {pool.tokenOut}</span>
                                  <span style={{marginLeft: '10px'}}>流动性: {pool.liquidity}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{fontSize: '0.8rem', color: '#f44336', backgroundColor: 'rgba(244, 67, 54, 0.1)', padding: '8px', borderRadius: '3px'}}>
                          <strong>❌ 错误原因:</strong> {route.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 统计信息 */}
            {routingResult.stats && (
              <div style={{fontSize: '0.8rem', color: '#aaa', display: 'flex', gap: 15, flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid #444'}}>
                 <span>⏱️ 总耗时: {routingResult.stats.totalTime}ms</span>
                 <span>🔍 路径发现: {routingResult.stats.discoveryTime}ms</span>
                 <span>💬 报价获取: {routingResult.stats.quoteTime}ms</span>
                 <span>🛣️ 发现路径: {routingResult.stats.totalRoutes}</span>
                 <span>✅ 有效路径: {routingResult.stats.successfulRoutes}</span>
              </div>
            )}
            
            {/* 错误详情 */}
            {routingResult.error && (
              <div style={{marginTop: '10px', padding: '10px', backgroundColor: '#3a1a1a', border: '1px solid #f44336', borderRadius: '4px', color: '#f44336', fontSize: '0.85rem'}}>
                <strong>系统错误:</strong> {routingResult.error}
              </div>
            )}

            {/* 池子诊断结果 */}
            {poolDiagnosis && (
              <div style={{marginTop: '15px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.3)', border: `1px solid ${poolDiagnosis.status === 'INITIALIZED' ? '#2e7d32' : '#f44336'}`, borderRadius: '6px'}}>
                <h5 style={{margin: '0 0 10px 0', color: poolDiagnosis.status === 'INITIALIZED' ? '#4ade80' : '#f44336'}}>
                  🔍 池子诊断结果
                </h5>
                <div style={{fontSize: '0.8rem', lineHeight: '1.6', color: '#aaa'}}>
                  <div><strong>状态:</strong> {poolDiagnosis.status}</div>
                  <div><strong>信息:</strong> {poolDiagnosis.message}</div>
                  {poolDiagnosis.token0 && <div><strong>Token0:</strong> {poolDiagnosis.token0.slice(0,8)}...</div>}
                  {poolDiagnosis.token1 && <div><strong>Token1:</strong> {poolDiagnosis.token1.slice(0,8)}...</div>}
                  {poolDiagnosis.fee && <div><strong>费率:</strong> {poolDiagnosis.fee}</div>}
                  {poolDiagnosis.sqrtPriceX96 && <div><strong>SqrtPrice:</strong> {poolDiagnosis.sqrtPriceX96.slice(0,20)}...</div>}
                  {poolDiagnosis.tick && <div><strong>Tick:</strong> {poolDiagnosis.tick}</div>}
                  {poolDiagnosis.balance0 && <div><strong>Balance0:</strong> {poolDiagnosis.balance0}</div>}
                  {poolDiagnosis.balance1 && <div><strong>Balance1:</strong> {poolDiagnosis.balance1}</div>}
                </div>
              </div>
            )}

            {/* 诊断按钮 - 显示在路由失败时 */}
            {!routingResult.success && routingResult.allRoutes && routingResult.allRoutes[0] && (
              <div style={{marginTop: '15px', textAlign: 'center'}}>
                <button 
                  onClick={() => {
                    const firstRoute = routingResult.allRoutes[0];
                    if (firstRoute.poolValidation && firstRoute.poolValidation[0]) {
                      handleDiagnosePool(firstRoute.poolValidation[0].poolAddress);
                    }
                  }}
                  disabled={diagnosisLoading}
                  style={{
                    padding: '8px 16px', 
                    background: '#3f51b5', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  {diagnosisLoading ? '诊断中...' : '🔧 诊断第一个池子'}
                </button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* 4. Factory 管理 (仅 Owner) */}
      {isOwner && (
        <div className="data-card" style={{marginTop: 30, border: '1px solid #4ade80'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
             <h3 style={{margin:0, display:'flex', alignItems:'center', gap:8}}><Settings size={20}/> Factory 管理</h3>
             <span style={{fontSize:'0.8rem', background:'#1a3a1a', color:'#4ade80', padding:'2px 8px', borderRadius:4}}>Owner 权限</span>
          </div>
          
          <div style={{marginTop: 15}}>
             <h4 style={{fontSize: '0.9rem', color: '#aaa'}}>查询配置</h4>
             <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                <input 
                   placeholder="Fee (e.g. 3000)" 
                   value={queryFee} 
                   onChange={e => setQueryFee(e.target.value)}
                   style={{width: 120}} 
                />
                <button onClick={handleQueryFeeTickSpacing} disabled={loading} style={{padding: '8px 12px', cursor:'pointer'}}>查询 Spacing</button>
             </div>
          </div>

          <div style={{marginTop: 20, paddingTop: 15, borderTop: '1px solid #333'}}>
             <h4 style={{fontSize: '0.9rem', color: '#aaa'}}>启用新配置</h4>
             <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
                <div className="input-group">
                   <label>费率 (Fee)</label>
                   <input type="number" placeholder="500" value={newFee} onChange={e => setNewFee(e.target.value)} />
                </div>
                <div className="input-group">
                   <label>Tick Spacing</label>
                   <input type="number" placeholder="10" value={tickSpacing} onChange={e => setTickSpacing(e.target.value)} />
                </div>
             </div>
             <button className="action-btn" onClick={handleEnableFeeCheck} disabled={loading} style={{marginTop: 10}}>
                {loading ? '处理中...' : '启用新费率层级'}
             </button>
          </div>
        </div>
      )}
      
      {/* 非 Owner 提示 */}
      {!isOwner && currentUser && !ownerCheckLoading && (
         <div style={{marginTop: 30, padding: 15, background: '#1a1a1a', borderRadius: 8, color: '#666', fontSize: '0.9rem', textAlign: 'center'}}>
            <ShieldAlert size={16} style={{marginBottom: 5}}/>
            <p style={{margin:0}}>Factory 管理功能仅向 Owner 开放</p>
         </div>
      )}
    </div>
  );
};

export default AdvancedTradePage;