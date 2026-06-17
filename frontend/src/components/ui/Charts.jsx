import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

export const PriceChart = ({ data, token0Symbol = 'Token0', token1Symbol = 'Token1' }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ 
        height: '200px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#111',
        borderRadius: '8px'
      }}>
        <span style={{ color: '#666', fontSize: '14px', letterSpacing: '0.5px' }}>NO PRICE DATA AVAILABLE</span>
      </div>
    );
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis 
          dataKey="timestamp" 
          tickFormatter={formatTimestamp}
          stroke="#888"
          fontSize={12}
        />
        <YAxis 
          stroke="#888"
          fontSize={12}
          domain={['auto', 'auto']}
        />
        <Tooltip 
          formatter={(value, name) => [value?.toFixed(8), name]}
          labelFormatter={(timestamp) => formatTimestamp(timestamp)}
          contentStyle={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: '6px',
            color: '#fff'
          }}
        />
        <Line 
          type="monotone" 
          dataKey="price" 
          stroke="#00D4AA" 
          strokeWidth={2}
          dot={{ fill: '#00D4AA', strokeWidth: 2, r: 3 }}
          name={`${token0Symbol}/${token1Symbol} Price`}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const LiquidityChart = ({ data, currentTick }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ 
        height: '300px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#111',
        borderRadius: '8px'
      }}>
        <span style={{ color: '#666', fontSize: '14px', letterSpacing: '0.5px' }}>NO LIQUIDITY DATA</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis 
          dataKey="tick" 
          stroke="#888"
          fontSize={12}
        />
        <YAxis 
          stroke="#888"
          fontSize={12}
        />
        <Tooltip 
          formatter={(value, name) => [
            name === 'liquidity' ? `${Number(value).toLocaleString()}` : value,
            name === 'liquidity' ? 'Liquidity' : name
          ]}
          contentStyle={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: '6px',
            color: '#fff'
          }}
        />
        <Area 
          type="monotone" 
          dataKey="liquidity" 
          stroke="#8884d8" 
          fill="#8884d8"
          fillOpacity={0.4}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export const VolumeChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ 
        height: '250px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#111',
        borderRadius: '8px'
      }}>
        <span style={{ color: '#666', fontSize: '14px', letterSpacing: '0.5px' }}>NO VOLUME DATA</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis 
          dataKey="timestamp" 
          tickFormatter={(timestamp) => {
            const date = new Date(timestamp * 1000);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }}
          stroke="#888"
          fontSize={12}
        />
        <YAxis 
          stroke="#888"
          fontSize={12}
        />
        <Tooltip 
          formatter={(value, name) => [
            `${Number(value).toFixed(4)}`,
            name === 'volume0' ? 'Token0 Vol' : 'Token1 Vol'
          ]}
          labelFormatter={(timestamp) => {
            const date = new Date(timestamp * 1000);
            return date.toLocaleString('en-US');
          }}
          contentStyle={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: '6px',
            color: '#fff'
          }}
        />
        <Bar dataKey="volume0" fill="#8884d8" name="Volume0" radius={[2, 2, 0, 0]} />
        <Bar dataKey="volume1" fill="#82ca9d" name="Volume1" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export const TVLPieChart = ({ data }) => {
  if (!data || (!data.token0TVL && !data.token1TVL)) {
    return (
      <div style={{ 
        height: '200px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#111',
        borderRadius: '8px'
      }}>
        <span style={{ color: '#666', fontSize: '14px', letterSpacing: '0.5px' }}>NO TVL DATA</span>
      </div>
    );
  }

  const pieData = [
    { name: data.token0Symbol || 'Token0', value: data.token0TVL, fill: '#00D4AA' },
    { name: data.token1Symbol || 'Token1', value: data.token1TVL, fill: '#FF6B6B' }
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
          outerRadius={65}
          innerRadius={40}
          stroke="none"
          dataKey="value"
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value) => [`$${value.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 'Total Value Locked']}
          contentStyle={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: '6px',
            color: '#fff'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const PriceImpactChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ 
        height: '200px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#111',
        borderRadius: '8px'
      }}>
        <span style={{ color: '#666', fontSize: '14px', letterSpacing: '0.5px' }}>NO IMPACT DATA</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis 
          dataKey="amount" 
          stroke="#888"
          fontSize={12}
          label={{ value: 'Trade Size', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 10 }}
        />
        <YAxis 
          stroke="#888"
          fontSize={12}
          tickFormatter={(value) => `${value.toFixed(2)}%`}
        />
        <Tooltip 
          formatter={(value) => [`${value.toFixed(4)}%`, 'Price Impact']}
          contentStyle={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: '6px',
            color: '#fff'
          }}
        />
        <Line 
          type="stepAfter" 
          dataKey="priceImpact" 
          stroke="#FF6B6B" 
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};