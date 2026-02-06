import React from 'react';
import { Copy, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const PoolInfoCard = ({ pool, isActive, onClick, showDetails = true }) => {
  if (!pool) return null;

  const copyAddress = (e) => {
    e.stopPropagation(); // 防止触发 Card 的 onClick
    navigator.clipboard.writeText(pool.address);
    toast.success('地址已复制');
  };

  return (
    <div 
      onClick={onClick}
      style={{
        padding: '15px',
        backgroundColor: isActive ? 'rgba(74, 222, 128, 0.1)' : '#222',
        borderRadius: '8px',
        border: `1px solid ${isActive ? '#4ade80' : '#333'}`,
        borderLeft: `4px solid ${isActive ? '#4ade80' : '#646cff'}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        marginBottom: '10px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {pool.token0Meta?.symbol || '??'}/{pool.token1Meta?.symbol || '??'} 
            <span style={{ 
              fontSize: '0.75rem', 
              color: '#aaa', 
              background: '#333', 
              padding: '2px 6px', 
              borderRadius: '4px',
              fontWeight: 'normal'
            }}>
              Fee: {pool.fee}
            </span>
          </div>
          
          <div style={{ fontSize: '0.75rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {pool.isInitialized ? (
              <span style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <CheckCircle size={12} /> 已初始化
              </span>
            ) : (
              <span style={{ color: '#ff9f40', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <AlertTriangle size={12} /> 未初始化
              </span>
            )}
          </div>
        </div>
        {isActive && <div style={{ color: '#4ade80', fontSize: '1.2rem' }}>✓</div>}
      </div>

      {showDetails && (
        <div style={{ 
          marginTop: '12px', 
          paddingTop: '8px', 
          borderTop: '1px solid #333', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <code style={{ fontSize: '0.7rem', color: '#888', wordBreak: 'break-all' }}>
            {pool.address}
          </code>
          <button 
            onClick={copyAddress}
            style={{ 
              padding: '4px 8px', 
              background: '#333', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer', 
              color: '#aaa',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Copy size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PoolInfoCard;