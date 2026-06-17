import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getPoolList, getFilteredPoolList, getSelectedPool, setSelectedPool, getPoolDisplayName, refreshPoolStatus } from "../../api/pools";
import { ensureSepolia } from "../../api/amm";

const PoolSelector = ({ onPoolSelect, selectedPool, allowEmpty = false, showCreateButton = false, onCreateNew }) => {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPools();
  }, []);

  const loadPools = () => {
    const poolList = getFilteredPoolList();
    setPools(poolList);
    
    if (!selectedPool && poolList.length > 0) {
      const lastSelected = getSelectedPool();
      if (lastSelected) {
        const found = poolList.find(p => p.address.toLowerCase() === lastSelected.address.toLowerCase());
        if (found && onPoolSelect) {
          onPoolSelect(found);
        }
      }
    }
  };

  const handlePoolChange = (e) => {
    const poolAddress = e.target.value;
    
    if (!poolAddress) {
      onPoolSelect && onPoolSelect(null);
      return;
    }
    
    const pool = pools.find(p => p.address === poolAddress);
    if (pool) {
      setSelectedPool(pool);
      onPoolSelect && onPoolSelect(pool);
    }
  };

  const handleRefreshPool = async (poolAddress) => {
    if (!window.ethereum) return;
    
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await ensureSepolia(provider);
      
      await refreshPoolStatus(provider, poolAddress);
      loadPools(); 
      
    } catch (err) {
      console.warn('Failed to refresh pool status:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pool-selector">
      <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
        <select 
          value={selectedPool?.address || ''} 
          onChange={handlePoolChange}
          style={{flex: 1}}
        >
          {allowEmpty && <option value="">Select Pool...</option>}
          {pools.length === 0 && !allowEmpty && <option value="">No pools available</option>}
          {pools.map(pool => (
            <option key={pool.address} value={pool.address}>
              {getPoolDisplayName(pool)} - {pool.address.slice(0,8)}...
              {pool.isInitialized ? ' (Active)' : ' (Uninitialized)'}
            </option>
          ))}
        </select>
        
        {selectedPool && (
          <button 
            onClick={() => handleRefreshPool(selectedPool.address)}
            disabled={loading}
            style={{
              padding: '6px 12px',
              backgroundColor: '#333',
              border: '1px solid #555',
              borderRadius: '4px',
              color: '#ccc',
              fontSize: '12px',
              cursor: loading ? 'wait' : 'pointer'
            }}
          >
            {loading ? 'Syncing...' : 'Sync'}
          </button>
        )}
        
        {showCreateButton && onCreateNew && (
          <button 
            onClick={onCreateNew}
            style={{
              padding: '6px 12px',
              backgroundColor: '#1a3a1a',
              border: '1px solid #4ade80',
              borderRadius: '4px',
              color: '#4ade80',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Create New Pool
          </button>
        )}
      </div>
      
      {selectedPool && (
        <div style={{
          marginTop: '10px', 
          padding: '10px', 
          backgroundColor: '#1a1a1a', 
          borderRadius: '4px', 
          fontSize: '12px'
        }}>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
            <div><strong>Address:</strong> {selectedPool.address.slice(0,8)}...{selectedPool.address.slice(-6)}</div>
            <div><strong>Fee Tier:</strong> {(selectedPool.fee/10000).toFixed(2)}%</div>
            <div><strong>Token 0:</strong> {selectedPool.token0Meta?.symbol || selectedPool.token0.slice(0,8)}</div>
            <div><strong>Token 1:</strong> {selectedPool.token1Meta?.symbol || selectedPool.token1.slice(0,8)}</div>
            <div><strong>Status:</strong> 
              <span style={{color: selectedPool.isInitialized ? '#4ade80' : '#f59e0b', marginLeft: '4px'}}>
                {selectedPool.isInitialized ? 'Active' : 'Pending Initialization'}
              </span>
            </div>
            {selectedPool.currentTick && (
              <div><strong>Current Tick:</strong> {selectedPool.currentTick}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PoolSelector;