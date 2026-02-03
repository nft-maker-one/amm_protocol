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

// 实时价格图表
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
        <span style={{ color: '#666' }}>暂无价格数据</span>
      </div>
    );
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
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
            backgroundColor: '#222', 
            border: '1px solid #444',
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
          name={`${token0Symbol}/${token1Symbol} 价格`}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

// 流动性分布图表
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
        <span style={{ color: '#666' }}>暂无流动性数据</span>
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
            name === 'liquidity' ? '流动性' : name
          ]}
          contentStyle={{ 
            backgroundColor: '#222', 
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff'
          }}
        />
        <Area 
          type="monotone" 
          dataKey="liquidity" 
          stroke="#8884d8" 
          fill="#8884d8"
          fillOpacity={0.6}
        />
        {currentTick && (
          <Line 
            type="monotone" 
            dataKey={null}
            stroke="#FF6B6B"
            strokeWidth={3}
            dot={false}
            // 在当前tick位置画一条垂直线
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
};

// 交易量图表
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
        <span style={{ color: '#666' }}>暂无交易量数据</span>
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
            return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
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
            name === 'volume0' ? 'Token0 交易量' : 'Token1 交易量'
          ]}
          labelFormatter={(timestamp) => {
            const date = new Date(timestamp * 1000);
            return date.toLocaleString('zh-CN');
          }}
          contentStyle={{ 
            backgroundColor: '#222', 
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff'
          }}
        />
        <Bar dataKey="volume0" fill="#8884d8" name="volume0" />
        <Bar dataKey="volume1" fill="#82ca9d" name="volume1" />
      </BarChart>
    </ResponsiveContainer>
  );
};

// TVL组成饼图
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
        <span style={{ color: '#666' }}>暂无TVL数据</span>
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
          outerRadius={60}
          fill="#8884d8"
          dataKey="value"
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value) => [`$${value.toFixed(2)}`, '总锁定价值']}
          contentStyle={{ 
            backgroundColor: '#222', 
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

// 价格影响图表
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
        <span style={{ color: '#666' }}>暂无价格影响数据</span>
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
        />
        <YAxis 
          stroke="#888"
          fontSize={12}
          tickFormatter={(value) => `${value.toFixed(2)}%`}
        />
        <Tooltip 
          formatter={(value) => [`${value.toFixed(4)}%`, '价格影响']}
          contentStyle={{ 
            backgroundColor: '#222', 
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff'
          }}
        />
        <Line 
          type="monotone" 
          dataKey="priceImpact" 
          stroke="#FF6B6B" 
          strokeWidth={2}
          dot={{ fill: '#FF6B6B', strokeWidth: 2, r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};