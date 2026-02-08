import React, { useState, useRef, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { 
  Route, 
  CheckCircle, 
  XCircle,
} from 'lucide-react';

import {
  ensureSepolia,
  AMMFACTORY_ADDRESS,
  getPoolLiquidity,
  readSlot0,
  estimateSwapOut,
  checkPoolStatus
} from '../api/amm';
import {
  MultiHopRouter,
  COMMON_CHAINS
} from '../api/routing';
import { getTokenList } from '../api/tokens';
import TokenInputSelector from '../components/ui/TokenInputSelector';

const AdvancedTradePage = () => {
  const [tokenList, setTokenList] = useState(getTokenList());
  const [loading, setLoading] = useState(false);
  
  const [tokenInChoice, setTokenInChoice] = useState('0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'); // WETH
  const [tokenInCustom, setTokenInCustom] = useState('');
  const [tokenOutChoice, setTokenOutChoice] = useState('0x779877A7B0D9E8603169DdbD7836e478b4624789'); // LINK
  const [tokenOutCustom, setTokenOutCustom] = useState('');
  
  const [selectedChain, setSelectedChain] = useState(11155111);
  const [routeAmount, setRouteAmount] = useState('');
  const [maxHops, setMaxHops] = useState('3');
  const [slippageTolerance, setSlippageTolerance] = useState('0.5');
  const [routingResult, setRoutingResult] = useState(null);
  const [routingLoading, setRoutingLoading] = useState(false);

  const [poolDiagnosis, setPoolDiagnosis] = useState(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);

  const resultRef = useRef(null);

  const handleTestAdvancedRouting = async () => {
    if (!window.ethereum) return toast.error('Please connect wallet first');
    
    const finalTokenIn = tokenInChoice === 'custom' ? tokenInCustom : tokenInChoice;
    const finalTokenOut = tokenOutChoice === 'custom' ? tokenOutCustom : tokenOutChoice;
    
    if (!ethers.isAddress(finalTokenIn) || !ethers.isAddress(finalTokenOut)) return toast.error('Invalid token address');
    if (!routeAmount || parseFloat(routeAmount) <= 0) return toast.error('Invalid amount');

    setRoutingLoading(true);
    setRoutingResult(null);
    const toastId = toast.loading('Running advanced routing algorithm...');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);

      const amountIn = ethers.parseEther(routeAmount);
      const maxHopsNum = parseInt(maxHops) || 3;
      const router = new MultiHopRouter(provider, AMMFACTORY_ADDRESS);

      const startTime = Date.now();
      const allRoutes = await router.generatePossibleRoutes(finalTokenIn, finalTokenOut, maxHopsNum);
      const discoveryTime = Date.now() - startTime;

      if (allRoutes.length === 0) {
        setRoutingResult({
          success: false, stage: 'discovery', error: 'No routes found', stats: { discoveryTime, totalRoutes: 0 }
        });
        toast.error('No routes found', { id: toastId });
        return;
      }

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
            const tokenOut = route.tokens[j+1];
            const fee = route.fees[j];
            const poolAddr = await router.getPoolAddress(tokenIn, tokenOut, fee);
            
            const [liquidity, slot0] = await Promise.all([
               getPoolLiquidity(provider, poolAddr),
               readSlot0(provider, poolAddr)
            ]);
            
            if (liquidity === 0n) throw new Error(`Hop ${j+1} No Liquidity`);
            
            poolValidation.push({
               hop: j+1, poolAddress: poolAddr, liquidity: liquidity.toString(),
               currentTick: slot0[1].toString(),
               tokenIn: tokenIn.slice(0,6)+'...', tokenOut: tokenOut.slice(0,6)+'...', fee
            });
          }
          
          const quote = await router.getRouteQuote(route, amountIn);
          
          // Validate that output is meaningful (reject if less than 1 wei worth)
          if (!quote.amountOut || quote.amountOut <= 0n) {
            throw new Error('Output is 0 - pool lacks liquidity. Add liquidity first.');
          }
          
          const formattedOut = ethers.formatEther(quote.amountOut);
          const routeData = {
             index: i + 1, path: route.tokens.join(' -> '), fees: route.fees, hops: route.hops,
             amountOut: formattedOut, priceImpact: quote.priceImpact,
             estimatedGas: quote.gas, poolValidation, success: true
          };
          
          routeAnalysis.push(routeData);
          if (quote.amountOut > bestAmountOut) {
             bestAmountOut = quote.amountOut;
             bestRoute = { ...route, quote, analysis: routeData };
          }
        } catch (err) {
           routeAnalysis.push({
             index: i + 1, path: route.tokens.join(' -> '), fees: route.fees, hops: route.hops,
             error: err.message, success: false
           });
        }
      }

      const quoteTime = Date.now() - quoteStartTime;

      let simulationResult = null;
      if (bestRoute) {
         simulationResult = { success: true, finalAmountOut: ethers.formatEther(bestAmountOut) };
      }

      const totalTime = Date.now() - startTime;
      const successfulRoutes = routeAnalysis.filter(r => r.success);

      const result = {
         success: !!bestRoute,
         bestRoute: bestRoute ? {
           path: bestRoute.tokens.join(' -> '), hops: bestRoute.hops, fees: bestRoute.fees,
           amountOut: ethers.formatEther(bestAmountOut), priceImpact: bestRoute.quote.priceImpact,
           estimatedGas: bestRoute.quote.gas
         } : null,
         allRoutes: routeAnalysis,
         simulation: simulationResult,
         stats: { totalTime, discoveryTime, quoteTime, totalRoutes: allRoutes.length, successfulRoutes: successfulRoutes.length }
      };

      setRoutingResult(result);
      if (result.success) {
        toast.success(`Found ${successfulRoutes.length} routes`, { id: toastId });
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        toast.error('All routes invalid', { id: toastId });
      }

    } catch (err) {
      toast.error('Routing error: ' + err.message, { id: toastId });
      setRoutingResult({ success: false, error: err.message });
    } finally {
      setRoutingLoading(false);
    }
  };

  const handleDiagnosePool = async (poolAddress) => {
    if (!window.ethereum) return toast.error('Please connect wallet first');
    const toastId = toast.loading('Diagnosing pool status...');
    try {
      setDiagnosisLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      const status = await checkPoolStatus(provider, poolAddress);
      setPoolDiagnosis(status);
      if (status.status === 'INITIALIZED') toast.success('Pool Initialized', { id: toastId });
      else toast.error(`Status: ${status.status}`, { id: toastId });
    } catch (err) {
      toast.error('Diagnosis failed: ' + err.message, { id: toastId });
    } finally {
      setDiagnosisLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>Advanced Routing & Settings</h2>
      
      <div className="input-group">
        <label>Target Chain</label>
        <select value={selectedChain} onChange={e => setSelectedChain(Number(e.target.value))}>
          {COMMON_CHAINS.map(chain => (
            <option key={chain.id} value={chain.id}>{chain.name} {chain.isTestnet ? '(Testnet)' : ''}</option>
          ))}
        </select>
        <small style={{color: '#666', marginTop: '5px', display: 'block'}}>Default support for Sepolia Ethereum Testnet</small>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
         <div className="input-group">
            <label>Max Slippage (%)</label>
            <input type="number" value={slippageTolerance} onChange={e => setSlippageTolerance(e.target.value)} step="0.1" />
         </div>
         <div className="input-group">
            <label>Transaction Deadline (mins)</label>
            <input type="number" defaultValue="20" />
         </div>
      </div>
      
      <button className="action-btn" onClick={() => toast.success("Settings Saved (Local)")}>Save Preferences</button>

      <div className="data-card" style={{marginTop: 30}}>
        <h3 style={{display:'flex', alignItems:'center', gap: 8}}><Route size={20}/> Advanced Multi-Hop Routing Test</h3>
        <p style={{color: '#888', marginBottom: '20px', fontSize: '0.9rem'}}>Verify multi-hop routing algorithm: Path Discovery &rarr; On-chain Quote &rarr; Best Selection</p>

        <div style={{background: '#151515', padding: 15, borderRadius: 8}}>
            <TokenInputSelector 
              label="Token In" 
              choice={tokenInChoice} 
              setChoice={setTokenInChoice} 
              customValue={tokenInCustom} 
              setCustomValue={setTokenInCustom} 
              tokenList={tokenList} 
            />
            
            <TokenInputSelector 
              label="Token Out" 
              choice={tokenOutChoice} 
              setChoice={setTokenOutChoice} 
              customValue={tokenOutCustom} 
              setCustomValue={setTokenOutCustom} 
              tokenList={tokenList} 
            />

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
                <div className="input-group">
                    <label>Amount</label>
                    <input type="number" value={routeAmount} onChange={e => setRouteAmount(e.target.value)} placeholder="1.0" />
                </div>
                <div className="input-group">
                    <label>Max Hops</label>
                    <select value={maxHops} onChange={e => setMaxHops(e.target.value)}>
                        <option value="1">1 Hop (Direct)</option>
                        <option value="2">2 Hops</option>
                        <option value="3">3 Hops</option>
                        <option value="4">4 Hops</option>
                    </select>
                </div>
            </div>
            <button className="action-btn" onClick={handleTestAdvancedRouting} disabled={routingLoading} style={{marginTop: 10, background: '#2e7d32'}}>
              {routingLoading ? 'Calculating...' : 'Start Routing Calculation'}
            </button>
        </div>

        <div ref={resultRef}>
        {routingResult && (
          <div style={{marginTop: '20px', padding: '15px', backgroundColor: routingResult.success ? '#1a2f1a' : '#2f1a1a', borderRadius: '8px', border: routingResult.success ? '1px solid #2e7d32' : '1px solid #c62828'}}>
            <h4 style={{margin: '0 0 15px 0', color: routingResult.success ? '#4CAF50' : '#f44336', display: 'flex', alignItems:'center', gap: 8}}>
              {routingResult.success ? <CheckCircle size={18}/> : <XCircle size={18}/>}
              {routingResult.success ? 'Routing Calculation Complete' : 'Routing Calculation Failed'}
            </h4>

            {routingResult.bestRoute && (
              <div style={{marginBottom: '15px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '6px'}}>
                <h5 style={{margin: '0 0 10px 0', color: '#4ade80'}}>Best Route</h5>
                <div style={{fontSize: '0.9rem', lineHeight: '1.6'}}>
                  <div><strong>Path:</strong> {routingResult.bestRoute.path}</div>
                  <div><strong>Output:</strong> {(() => {
                    const val = Number(routingResult.bestRoute.amountOut);
                    if (val === 0) return '0 (no liquidity)';
                    if (val < 0.000001) return val.toExponential(4);
                    return val.toFixed(6);
                  })()} tokens</div>
                  <div><strong>Gas est:</strong> {routingResult.bestRoute.estimatedGas?.toLocaleString()}</div>
                </div>
              </div>
            )}
            
            {routingResult.allRoutes && routingResult.allRoutes.length > 0 && (
              <div style={{marginBottom: '15px', marginTop: '15px'}}>
                <h5 style={{margin: '0 0 10px 0', color: '#FFA726'}}>All Routes Analysis</h5>
                <div style={{maxHeight: '400px', overflowY: 'auto', borderTop: '1px solid #444', paddingTop: '10px'}}>
                  {routingResult.allRoutes.map((route, idx) => (
                    <div key={idx} style={{marginBottom: '12px', padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px', border: route.success ? '1px solid #2e7d32' : '1px solid #c62828'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                        <span style={{fontSize: '0.85rem', fontWeight: 'bold'}}>Route #{route.index}: {route.path}</span>
                        <span style={{fontSize: '0.75rem', background: route.success ? '#1a3a1a' : '#3a1a1a', color: route.success ? '#4ade80' : '#f44336', padding: '2px 6px', borderRadius: '3px'}}>
                          {route.success ? 'Valid' : 'Invalid'}
                        </span>
                      </div>
                      
                      {route.success ? (
                        <div style={{fontSize: '0.8rem', color: '#aaa', lineHeight: '1.5'}}>
                          <div>Output: {Number(route.amountOut) < 0.000001 ? Number(route.amountOut).toExponential(4) : Number(route.amountOut).toFixed(6)}</div>
                          <div>Gas: {route.estimatedGas?.toLocaleString() || 'N/A'}</div>
                          {route.poolValidation && route.poolValidation.length > 0 && (
                            <div style={{marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #444'}}>
                              {route.poolValidation.map((pool, pidx) => (
                                <div key={pidx} style={{fontSize: '0.75rem', color: '#999'}}>
                                  <span>Hop {pool.hop}: {pool.tokenIn} &rarr; {pool.tokenOut} (Liq: {pool.liquidity})</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{fontSize: '0.8rem', color: '#f44336'}}><strong>Error:</strong> {route.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {routingResult.stats && (
              <div style={{fontSize: '0.8rem', color: '#aaa', display: 'flex', gap: 15, flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid #444'}}>
                 <span>Total Time: {routingResult.stats.totalTime}ms</span>
                 <span>Routes Found: {routingResult.stats.totalRoutes}</span>
                 <span>Valid Routes: {routingResult.stats.successfulRoutes}</span>
              </div>
            )}

            {poolDiagnosis && (
              <div style={{marginTop: '15px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.3)', border: `1px solid ${poolDiagnosis.status === 'INITIALIZED' ? '#2e7d32' : '#f44336'}`, borderRadius: '6px'}}>
                <h5 style={{margin: '0 0 10px 0', color: poolDiagnosis.status === 'INITIALIZED' ? '#4ade80' : '#f44336'}}>Diagnosis Result: {poolDiagnosis.status}</h5>
                <div style={{fontSize: '0.8rem', lineHeight: '1.6', color: '#aaa'}}>
                  {poolDiagnosis.fee && <div>Fee: {poolDiagnosis.fee}</div>}
                  {poolDiagnosis.sqrtPriceX96 && <div>SqrtPrice: {poolDiagnosis.sqrtPriceX96.slice(0,10)}...</div>}
                  {poolDiagnosis.tick && <div>Tick: {poolDiagnosis.tick}</div>}
                </div>
              </div>
            )}

            {!routingResult.success && routingResult.allRoutes && routingResult.allRoutes[0] && (
              <div style={{marginTop: '15px', textAlign: 'center'}}>
                <button onClick={() => {
                    const firstRoute = routingResult.allRoutes[0];
                    if (firstRoute.poolValidation && firstRoute.poolValidation[0]) handleDiagnosePool(firstRoute.poolValidation[0].poolAddress);
                  }}
                  disabled={diagnosisLoading}
                  style={{padding: '8px 16px', background: '#3f51b5', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem'}}
                >
                  {diagnosisLoading ? 'Diagnosing...' : 'Diagnose First Pool'}
                </button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedTradePage;