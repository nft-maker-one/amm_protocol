import React, { useState } from 'react';
import { ethers } from 'ethers';
import {
  ensureSepolia,
  enableFeeAmount,
  getFactoryOwner,
  getFeeAmountTickSpacing,
  AMMFACTORY_ADDRESS,
  getPoolLiquidity,
  readSlot0,
  estimateSwapOut
} from '../api/amm';
import {
  MultiHopRouter,
  findBestTrade,
  executeBestTrade,
  COMMON_TOKENS,
  COMMON_FEES
} from '../api/routing';
import { TOKENS } from '../api/tokens';

const AdvancedTradePage = () => {
  const [newFee, setNewFee] = useState('');
  const [tickSpacing, setTickSpacing] = useState('');
  const [queryFee, setQueryFee] = useState('3000');
  const [factoryOwner, setFactoryOwner] = useState(null);
  const [feeTickSpacing, setFeeTickSpacing] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Owner权限相关
  const [currentUser, setCurrentUser] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerCheckLoading, setOwnerCheckLoading] = useState(false);
  
  // 路由测试状态
  const [routeTokenIn, setRouteTokenIn] = useState('');
  const [routeTokenOut, setRouteTokenOut] = useState('');
  const [routeAmount, setRouteAmount] = useState('');
  const [maxHops, setMaxHops] = useState('3');
  const [slippageTolerance, setSlippageTolerance] = useState('0.5');
  const [routingResult, setRoutingResult] = useState(null);
  const [routingLoading, setRoutingLoading] = useState(false);

  const handleEnableFeeAmount = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!newFee || !tickSpacing) return alert('请输入费率和 tick spacing');
    
    const fee = Number(newFee);
    const spacing = Number(tickSpacing);
    
    if (Number.isNaN(fee) || Number.isNaN(spacing)) {
      return alert('费率和 tick spacing 必须是数字');
    }
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const signer = await provider.getSigner();
      
      const tx = await enableFeeAmount(provider, signer, fee, spacing);
      
      alert(
        `启用新费率层级成功！\n` +
        `费率: ${(fee / 10000).toFixed(2)}%\n` +
        `Tick Spacing: ${spacing}\n` +
        `tx: ${tx.hash}\n\n` +
        `注意：只有 Factory 的 owner 才能调用此功能`
      );
    } catch (err) {
      alert('启用费率失败: ' + (err.message || err) + '\n\n可能原因：您不是 Factory 的 owner');
    } finally {
      setLoading(false);
    }
  };

  const handleQueryFactoryOwner = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      const owner = await getFactoryOwner(provider);
      setFactoryOwner(owner);
      
      alert(`Factory Owner: ${owner}`);
    } catch (err) {
      alert('查询 Factory Owner 失败: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleQueryFeeTickSpacing = async () => {
    if (!window.ethereum) return alert('请先连接钱包');
    if (!queryFee) return alert('请输入费率');
    
    const fee = Number(queryFee);
    if (Number.isNaN(fee)) return alert('费率必须是数字');
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      const spacing = await getFeeAmountTickSpacing(provider, fee);
      setFeeTickSpacing(spacing);
      
      if (spacing === 0) {
        alert(`费率 ${fee} (${(fee / 10000).toFixed(2)}%) 未启用或不存在`);
      } else {
        alert(
          `费率查询成功！\n` +
          `费率: ${fee} (${(fee / 10000).toFixed(2)}%)\n` +
          `Tick Spacing: ${spacing}`
        );
      }
    } catch (err) {
      alert('查询费率信息失败: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // 检查当前用户是否为Factory Owner
  const checkOwnerStatus = async () => {
    if (!window.ethereum) {
      console.log('❌ 钱包未连接');
      return;
    }

    try {
      setOwnerCheckLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      // 获取当前用户地址
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      setCurrentUser(userAddress);
      
      // 获取Factory Owner
      const owner = await getFactoryOwner(provider);
      setFactoryOwner(owner);
      
      // 比较地址（忽略大小写）
      const isUserOwner = userAddress.toLowerCase() === owner.toLowerCase();
      setIsOwner(isUserOwner);
      
      console.log(`👤 当前用户: ${userAddress}`);
      console.log(`👑 Factory Owner: ${owner}`);
      console.log(`🔐 是否为Owner: ${isUserOwner}`);
      
    } catch (err) {
      console.error('检查Owner状态失败:', err);
      setIsOwner(false);
    } finally {
      setOwnerCheckLoading(false);
    }
  };

  // 组件加载时检查Owner状态
  React.useEffect(() => {
    if (window.ethereum) {
      checkOwnerStatus();
      
      // 监听账户变化
      const handleAccountsChanged = () => {
        setTimeout(checkOwnerStatus, 100);
      };
      
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  // 测试高级路由功能
  const handleTestAdvancedRouting = async () => {
    console.log('🚀 点击了路由测试按钮');
    
    if (!window.ethereum) {
      console.log('❌ 钱包未连接');
      return alert('请先连接钱包');
    }
    
    console.log('检查代币地址...', { routeTokenIn, routeTokenOut });
    if (!ethers.isAddress(routeTokenIn) || !ethers.isAddress(routeTokenOut)) {
      console.log('❌ 代币地址无效');
      return alert('请输入有效的代币地址');
    }
    
    if (!routeAmount || parseFloat(routeAmount) <= 0) {
      console.log('❌ 交易金额无效');
      return alert('请输入有效的交易金额');
    }

    console.log('✅ 所有输入验证通过，开始测试...');

    try {
      setRoutingLoading(true);
      setRoutingResult(null);
      console.log('🔗 连接区块链提供者...');
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      console.log('✅ 网络切换完成');

      const amountIn = ethers.parseEther(routeAmount);
      const maxHopsNum = parseInt(maxHops) || 3;

      console.log('🚀 开始高级路由测试...');
      console.log(`输入代币: ${routeTokenIn}`);
      console.log(`输出代币: ${routeTokenOut}`);
      console.log(`金额: ${routeAmount} ETH (${amountIn.toString()} wei)`);
      console.log(`最大跳数: ${maxHopsNum}`);
      console.log(`工厂地址: ${AMMFACTORY_ADDRESS}`);

      console.log('🛠️ 创建路由器实例...');
      const router = new MultiHopRouter(provider, AMMFACTORY_ADDRESS);
      console.log('✅ 路由器创建成功');

      // 阶段1: 路径发现
      console.log('🔍 阶段1: 开始路径发现...');
      const startTime = Date.now();
      
      const allRoutes = await router.generatePossibleRoutes(routeTokenIn, routeTokenOut, maxHopsNum);
      const discoveryTime = Date.now() - startTime;
      console.log(`✅ 路径发现完成: 找到 ${allRoutes.length} 条路径，耗时 ${discoveryTime}ms`);

      if (allRoutes.length === 0) {
        console.log('❌ 未发现任何可用路径');
        setRoutingResult({
          success: false,
          stage: 'discovery',
          error: '未发现任何可用路径。可能原因：1) 代币对之间没有流动性池 2) 工厂合约配置问题',
          stats: { discoveryTime, totalRoutes: 0 }
        });
        return;
      }

      // 阶段2: 报价获取和路径验证
      const quoteStartTime = Date.now();
      const routeAnalysis = [];
      let bestRoute = null;
      let bestAmountOut = 0n;

      for (let i = 0; i < allRoutes.length; i++) {
        const route = allRoutes[i];
        try {
          const poolValidation = [];
          for (let j = 0; j < route.hops; j++) {
            const tokenIn = route.tokens[j];
            const tokenOut = route.tokens[j + 1];
            const fee = route.fees[j];
            
            const poolAddr = await router.getPoolAddress(tokenIn, tokenOut, fee);
            if (!poolAddr) throw new Error(`第${j + 1}跳池子不存在`);
            
            const [liquidity, slot0] = await Promise.all([
              getPoolLiquidity(provider, poolAddr),
              readSlot0(provider, poolAddr)
            ]);
            
            if (liquidity === 0n) throw new Error(`第${j + 1}跳池子无流动性`);
            
            poolValidation.push({
              hop: j + 1,
              poolAddress: poolAddr,
              liquidity: liquidity.toString(),
              currentTick: slot0[1].toString(),
              tokenIn: tokenIn.slice(0, 6) + '...',
              tokenOut: tokenOut.slice(0, 6) + '...',
              fee: fee
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
          
          for (let i = 0; i < bestRoute.hops; i++) {
            const tokenIn = bestRoute.tokens[i];
            const tokenOut = bestRoute.tokens[i + 1];
            const fee = bestRoute.fees[i];
            const poolAddr = await router.getPoolAddress(tokenIn, tokenOut, fee);
            const zeroForOne = tokenIn.toLowerCase() < tokenOut.toLowerCase();
            
            const stepQuote = await estimateSwapOut(provider, poolAddr, zeroForOne, currentAmount);
            
            simulationSteps.push({
              step: i + 1,
              tokenIn: tokenIn.slice(0, 6) + '...',
              tokenOut: tokenOut.slice(0, 6) + '...',
              amountIn: ethers.formatEther(currentAmount),
              amountOut: ethers.formatEther(stepQuote.amountOut),
              poolAddress: poolAddr.slice(0, 6) + '...',
              fee: fee
            });
            
            currentAmount = stepQuote.amountOut;
          }
          
          simulationResult = {
            success: true,
            steps: simulationSteps,
            finalAmountOut: ethers.formatEther(currentAmount)
          };
        } catch (err) {
          simulationResult = { success: false, error: err.message };
        }
      }

      const totalTime = Date.now() - startTime;
      const successfulRoutes = routeAnalysis.filter(r => r.success);
      
      const result = {
        success: bestRoute ? true : false,
        stage: 'complete',
        bestRoute: bestRoute ? {
          path: bestRoute.tokens.join(' → '),
          fees: bestRoute.fees,
          hops: bestRoute.hops,
          amountIn: ethers.formatEther(amountIn),
          amountOut: ethers.formatEther(bestAmountOut),
          priceImpact: bestRoute.quote.priceImpact,
          estimatedGas: bestRoute.quote.gas,
          poolDetails: bestRoute.analysis.poolValidation
        } : null,
        allRoutes: routeAnalysis,
        simulation: simulationResult,
        stats: {
          totalTime,
          discoveryTime,
          quoteTime,
          totalRoutes: allRoutes.length,
          successfulRoutes: successfulRoutes.length,
          failedRoutes: allRoutes.length - successfulRoutes.length
        }
      };

      setRoutingResult(result);

      if (result.success) {
        alert(
          `🎉 高级路由测试成功！\n\n` +
          `最佳路径: ${bestRoute.tokens.join(' → ')}\n` +
          `输出: ${ethers.formatEther(bestAmountOut)} tokens\n` +
          `成功路径: ${successfulRoutes.length}/${allRoutes.length}\n` +
          `总耗时: ${totalTime}ms`
        );
      } else {
        alert(`❌ 路由测试失败：所有路径都无法获得有效报价`);
      }

    } catch (err) {
      console.error('路由测试失败:', err);
      setRoutingResult({
        success: false,
        stage: 'error',
        error: err.message
      });
      alert(`❌ 路由测试出错: ${err.message}`);
    } finally {
      setRoutingLoading(false);
    }
  };

  const handleQuickRouteTest = (tokenIn, tokenOut, amount) => {
    setRouteTokenIn(tokenIn);
    setRouteTokenOut(tokenOut);
    setRouteAmount(amount);
  };

  return (
    <div className="container">
      <h2>🚀 高级路由与设置</h2>
      
      <div className="input-group">
        <label>跨链兑换 (目标链)</label>
        <select>
          <option>Ethereum (Local)</option>
          <option>Optimism</option>
          <option>Arbitrum</option>
        </select>
        <small style={{color: '#888', marginTop: '5px', display: 'block'}}>
          跨链功能需要集成桥接协议（如 LayerZero, Stargate 等）
        </small>
      </div>

      <div className="input-group">
        <label>最大滑点保护 (%)</label>
        <input 
          type="number" 
          value={slippageTolerance} 
          onChange={e => setSlippageTolerance(e.target.value)}
          step="0.1"
          min="0.1"
          max="50"
        />
      </div>

      <div className="input-group">
        <label>交易截止时间 (分钟)</label>
        <input type="number" defaultValue="20" />
      </div>

      <div className="data-card">
        <h3>🛣️ 高级多跳路由测试</h3>
        <p style={{color: '#888', marginBottom: '20px'}}>
          验证多跳路由算法的完整功能：路径发现、报价比较、最优选择和执行模拟
        </p>

        {/* 快速测试按钮 */}
        <div style={{marginBottom: '20px'}}>
          <h4 style={{fontSize: '14px', marginBottom: '10px', color: '#FFA726'}}>🚀 快速测试</h4>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px'}}>
            <button 
              style={{padding: '8px', fontSize: '12px', backgroundColor: '#1a3a1a'}}
              onClick={() => handleQuickRouteTest(TOKENS.USDT.address, TOKENS.ETH.address, '1')}
            >
              测试 USDT → ETH (1 ETH)
            </button>
            <button 
              style={{padding: '8px', fontSize: '12px', backgroundColor: '#1a3a1a'}}
              onClick={() => handleQuickRouteTest(TOKENS.ETH.address, TOKENS.USDC.address, '0.5')}
            >
              测试 ETH → USDC (0.5 ETH)
            </button>
            <button 
              style={{padding: '8px', fontSize: '12px', backgroundColor: '#1a3a1a'}}
              onClick={() => handleQuickRouteTest(TOKENS.DAI.address, TOKENS.WBTC.address, '100')}
            >
              测试 DAI → WBTC (100 ETH)
            </button>
          </div>
        </div>

        {/* 自定义路由测试 */}
        <div className="input-group">
          <h4 style={{fontSize: '14px', marginBottom: '10px', color: '#81C784'}}>🔧 自定义测试</h4>
          <label>输入代币地址</label>
          <input 
            placeholder="0x..." 
            value={routeTokenIn} 
            onChange={e => setRouteTokenIn(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>输出代币地址</label>
          <input 
            placeholder="0x..." 
            value={routeTokenOut} 
            onChange={e => setRouteTokenOut(e.target.value)}
          />
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
          <div className="input-group">
            <label>交易金额 (ETH)</label>
            <input 
              type="number" 
              placeholder="1.0" 
              value={routeAmount} 
              onChange={e => setRouteAmount(e.target.value)}
              step="0.1"
              min="0.01"
            />
          </div>
          <div className="input-group">
            <label>最大跳数</label>
            <select value={maxHops} onChange={e => setMaxHops(e.target.value)}>
              <option value="1">1 跳 (直接)</option>
              <option value="2">2 跳</option>
              <option value="3">3 跳</option>
              <option value="4">4 跳</option>
            </select>
          </div>
        </div>

        <button 
          className="action-btn" 
          onClick={handleTestAdvancedRouting} 
          disabled={routingLoading || !routeTokenIn || !routeTokenOut || !routeAmount}
          style={{marginTop: '15px', width: '100%'}}
        >
          {routingLoading ? '🔄 测试进行中...' : '🚀 开始高级路由测试'}
        </button>

        {/* 调试按钮 */}
        <button 
          style={{marginTop: '10px', padding: '8px 16px', backgroundColor: '#333', border: '1px solid #555', borderRadius: '4px', color: '#ccc', fontSize: '12px'}}
          onClick={() => {
            console.log('调试点击事件触发');
            console.log('当前状态:', {
              routeTokenIn,
              routeTokenOut,
              routeAmount,
              maxHops,
              routingLoading,
              AMMFACTORY_ADDRESS
            });
            alert('调试信息已输出到控制台，请按F12查看Console');
          }}
        >
          🐛 调试信息
        </button>

        {/* 路由测试结果 */}
        {routingResult && (
          <div style={{marginTop: '20px', padding: '15px', backgroundColor: routingResult.success ? '#1a2f1a' : '#2f1a1a', borderRadius: '8px'}}>
            <h4 style={{margin: '0 0 15px 0', color: routingResult.success ? '#4CAF50' : '#f44336'}}>
              {routingResult.success ? '✅ 路由测试完成' : '❌ 路由测试失败'}
            </h4>

            {routingResult.error && (
              <p style={{margin: '0 0 15px 0', color: '#f44336', fontWeight: 'bold'}}>
                错误: {routingResult.error}
              </p>
            )}

            {/* 最佳路径信息 */}
            {routingResult.bestRoute && (
              <div style={{marginBottom: '20px', padding: '12px', backgroundColor: '#0f2f0f', borderRadius: '6px'}}>
                <h5 style={{margin: '0 0 10px 0', color: '#4ade80'}}>🏆 最佳路径</h5>
                <div style={{fontSize: '13px', lineHeight: '1.6'}}>
                  <p style={{margin: '0'}}><strong>路径:</strong> {routingResult.bestRoute.path}</p>
                  <p style={{margin: '0'}}><strong>跳数:</strong> {routingResult.bestRoute.hops} | <strong>费率:</strong> {routingResult.bestRoute.fees.join(', ')} bps</p>
                  <p style={{margin: '0'}}><strong>输入:</strong> {routingResult.bestRoute.amountIn} ETH</p>
                  <p style={{margin: '0'}}><strong>预期输出:</strong> {routingResult.bestRoute.amountOut} tokens</p>
                  <p style={{margin: '0'}}><strong>价格影响:</strong> {routingResult.bestRoute.priceImpact?.toFixed(4)}% | <strong>Gas估算:</strong> {routingResult.bestRoute.estimatedGas?.toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* 执行模拟结果 */}
            {routingResult.simulation && (
              <div style={{marginBottom: '20px', padding: '12px', backgroundColor: '#0a1a2a', borderRadius: '6px'}}>
                <h5 style={{margin: '0 0 10px 0', color: '#64B5F6'}}>🔄 执行模拟</h5>
                {routingResult.simulation.success ? (
                  <div>
                    <p style={{margin: '0 0 10px 0', fontSize: '13px', color: '#4CAF50'}}>
                      ✅ 模拟成功 - 最终输出: {routingResult.simulation.finalAmountOut} tokens
                    </p>
                    {routingResult.simulation.steps && (
                      <div style={{maxHeight: '150px', overflow: 'auto'}}>
                        {routingResult.simulation.steps.map((step, idx) => (
                          <div key={idx} style={{
                            fontSize: '11px',
                            padding: '4px 8px',
                            margin: '2px 0',
                            backgroundColor: '#1a1a1a',
                            borderRadius: '3px'
                          }}>
                            第{step.step}跳: {step.tokenIn} → {step.tokenOut} | 
                            输入: {step.amountIn.slice(0, 8)} → 输出: {step.amountOut.slice(0, 8)} | 
                            费率: {step.fee} bps
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{margin: '0', fontSize: '13px', color: '#f44336'}}>
                    ❌ 模拟失败: {routingResult.simulation.error}
                  </p>
                )}
              </div>
            )}

            {/* 性能统计 */}
            {routingResult.stats && (
              <div style={{marginBottom: '20px', padding: '12px', backgroundColor: '#1a1a0a', borderRadius: '6px'}}>
                <h5 style={{margin: '0 0 10px 0', color: '#FFA726'}}>📊 性能统计</h5>
                <div style={{fontSize: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px'}}>
                  <div><strong>总耗时:</strong> {routingResult.stats.totalTime}ms</div>
                  <div><strong>路径发现:</strong> {routingResult.stats.discoveryTime}ms</div>
                  <div><strong>报价获取:</strong> {routingResult.stats.quoteTime}ms</div>
                  <div><strong>发现路径:</strong> {routingResult.stats.totalRoutes}</div>
                  <div><strong>成功报价:</strong> {routingResult.stats.successfulRoutes}</div>
                  <div><strong>失败报价:</strong> {routingResult.stats.failedRoutes}</div>
                </div>
              </div>
            )}

            {/* 所有路径详情 */}
            {routingResult.allRoutes && routingResult.allRoutes.length > 0 && (
              <div>
                <h5 style={{margin: '0 0 10px 0', color: '#9CA3AF'}}>📋 所有路径详情</h5>
                <div style={{maxHeight: '200px', overflow: 'auto', fontSize: '11px'}}>
                  {routingResult.allRoutes.map((route, idx) => (
                    <div key={idx} style={{
                      padding: '8px',
                      marginBottom: '4px',
                      backgroundColor: '#0a0a0a',
                      borderRadius: '4px',
                      borderLeft: route.success ? '3px solid #4CAF50' : '3px solid #f44336'
                    }}>
                      <div><strong>#{route.index} {route.path}</strong> ({route.hops} 跳)</div>
                      <div>费率: {route.fees.join(', ')} bps</div>
                      {route.success ? (
                        <div style={{color: '#4CAF50'}}>
                          输出: {route.amountOut} tokens | Gas: {route.estimatedGas?.toLocaleString()}
                        </div>
                      ) : (
                        <div style={{color: '#f44336'}}>错误: {route.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{marginTop: '15px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontSize: '12px'}}>
          <p style={{margin: 0, color: '#888'}}>
            💡 这个测试会验证路由算法的完整流程：发现所有可能路径、获取每条路径的报价、选择最优路径，并模拟执行过程。
            测试结果包含详细的性能数据和每一跳的验证信息。
          </p>
        </div>
      </div>

      {/* Factory管理 - 仅Owner可见 */}
      {isOwner && (
        <div className="data-card" style={{marginTop: '30px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
            <h3 style={{margin: 0}}>⚙️ Factory 管理</h3>
            <div style={{padding: '6px 12px', background: '#1a3a1a', borderRadius: '4px', fontSize: '12px', border: '1px solid #4ade80'}}>
              <span style={{color: '#4ade80'}}>✅ Owner 权限</span>
            </div>
          </div>
          
          <p style={{color: '#888', marginBottom: '15px'}}>
            启用新的费率层级。您拥有 Factory 合约的 owner 权限。
          </p>

          <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
            <button 
              onClick={handleQueryFactoryOwner} 
              disabled={loading} 
              style={{padding: '8px 16px'}}
            >
              {loading ? '查询中...' : '🔍 重新查询 Owner'}
            </button>
            {factoryOwner && (
              <div style={{padding: '8px 12px', background: '#1a3a1a', borderRadius: '4px', fontSize: '12px'}}>
                <span style={{color: '#4ade80'}}>Owner: {factoryOwner.slice(0,6)}...{factoryOwner.slice(-4)}</span>
              </div>
            )}
          </div>

        <h4 style={{marginTop: '20px'}}>查询费率信息</h4>
        <div className="input-group">
          <label>查询费率 (基点)</label>
          <div style={{display: 'flex', gap: '10px'}}>
            <input 
              type="number" 
              placeholder="3000" 
              value={queryFee}
              onChange={e => setQueryFee(e.target.value)}
              style={{flex: 1}}
            />
            <button 
              onClick={handleQueryFeeTickSpacing} 
              disabled={loading}
            >
              {loading ? '查询中...' : '查询 Tick Spacing'}
            </button>
          </div>
          {feeTickSpacing !== null && (
            <div style={{marginTop: '8px', padding: '8px', background: '#1a1a1a', borderRadius: '4px', fontSize: '12px'}}>
              费率 {queryFee} ({((Number(queryFee) || 0) / 10000).toFixed(2)}%) → Tick Spacing: {feeTickSpacing}
              {feeTickSpacing === 0 && <span style={{color: '#e63946'}}> (未启用)</span>}
            </div>
          )}
        </div>
        
          <div className="input-group">
            <label>新费率 (基点，如 500 = 0.05%)</label>
            <input 
              type="number" 
              placeholder="500" 
              value={newFee}
              onChange={e => setNewFee(e.target.value)}
            />
            <small style={{color: '#888', marginTop: '5px', display: 'block'}}>
              常见费率：500 (0.05%), 3000 (0.3%), 10000 (1%)
            </small>
          </div>

          <div className="input-group">
            <label>Tick Spacing</label>
            <input 
              type="number" 
              placeholder="10" 
              value={tickSpacing}
              onChange={e => setTickSpacing(e.target.value)}
            />
            <small style={{color: '#888', marginTop: '5px', display: 'block'}}>
              常见 spacing：10 (for 0.05%), 60 (for 0.3%), 200 (for 1%)
            </small>
          </div>

          <button 
            className="action-btn" 
            onClick={handleEnableFeeAmount} 
            disabled={loading || !newFee || !tickSpacing}
            style={{marginTop: '10px'}}
          >
            {loading ? '启用中...' : '启用新费率层级'}
          </button>
          
          <div style={{marginTop: '15px', padding: '10px', backgroundColor: '#1a3a1a', borderRadius: '4px', border: '1px solid #4ade80'}}>
            <p style={{margin: 0, fontSize: '14px', color: '#4ade80'}}>
              ✅ 您拥有 Owner 权限，可以执行所有管理操作。
            </p>
          </div>
        </div>
      )}

      {/* 非Owner用户的提示信息 */}
      {currentUser && !ownerCheckLoading && !isOwner && (
        <div className="data-card" style={{marginTop: '30px'}}>
          <h3>⚙️ Factory 管理</h3>
          <div style={{padding: '15px', backgroundColor: '#2a1810', borderRadius: '6px', border: '1px solid #f59e0b', textAlign: 'center'}}>
            <p style={{margin: '0 0 10px 0', fontSize: '16px', color: '#f59e0b'}}>
              🔒 <strong>需要 Owner 权限</strong>
            </p>
            <p style={{margin: '0 0 15px 0', color: '#888', fontSize: '14px'}}>
              只有 Factory 合约的 Owner 才能访问管理功能
            </p>
            <div style={{fontSize: '13px', color: '#666'}}>
              <p style={{margin: '0 0 5px 0'}}>
                <strong>当前账户:</strong> {currentUser.slice(0, 6)}...{currentUser.slice(-4)}
              </p>
              {factoryOwner && (
                <p style={{margin: '0'}}>
                  <strong>Factory Owner:</strong> {factoryOwner.slice(0, 6)}...{factoryOwner.slice(-4)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      <button className="action-btn" style={{marginTop: '30px'}}>保存设置</button>
    </div>
  );
};

export default AdvancedTradePage;