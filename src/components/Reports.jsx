import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

const RADIAN = Math.PI / 180;

function Reports() {
  const MOBILE_OPTIMIZATIONS = {
    MAX_TRANSACTIONS: 50,
    MAX_CHART_ITEMS: 6,
    DEBOUNCE_TIME: 800,
  };

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const initialStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const initialEnd = new Date().toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({
    start: initialStart,
    end: initialEnd,
  });

  const [tempDateRange, setTempDateRange] = useState({
    start: initialStart,
    end: initialEnd,
  });

  const [chartType, setChartType] = useState('combined');
  const [screenInfo, setScreenInfo] = useState({
    isMobile: false,
    isTablet: false,
    isLandscape: false,
  });

  const fetchRef = useRef(null);
  const lastFetchRef = useRef('');

  // Screen info
  useEffect(() => {
    let resizeTimeout;
    
    const checkScreen = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width <= 768;
      const isTablet = width > 768 && width <= 1024;
      const isLandscape = width > height;
      
      setScreenInfo({
        isMobile,
        isTablet,
        isLandscape
      });
    };
    
    const debouncedCheckScreen = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(checkScreen, 100);
    };
    
    checkScreen();
    
    window.addEventListener('resize', debouncedCheckScreen);
    window.addEventListener('orientationchange', debouncedCheckScreen);
    
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', debouncedCheckScreen);
      window.removeEventListener('orientationchange', debouncedCheckScreen);
    };
  }, []);

  // Fetch data
  const fetchData = useCallback(async (startDate, endDate) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data } = await supabase
        .from('transactions')
        .select('*, categories(name, color)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .limit(100);
      
      setTransactions(data || []);
      lastFetchRef.current = `${startDate}-${endDate}`;
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync tempDateRange on mount
  useEffect(() => {
    setTempDateRange(dateRange);
  }, []);

  // Debounced fetch ketika dateRange (bukan temp) berubah
  useEffect(() => {
    const fetchKey = `${dateRange.start}-${dateRange.end}`;
    
    if (lastFetchRef.current === fetchKey) {
      return;
    }
    
    if (fetchRef.current) {
      clearTimeout(fetchRef.current);
    }
    
    fetchRef.current = setTimeout(() => {
      fetchData(dateRange.start, dateRange.end);
    }, MOBILE_OPTIMIZATIONS.DEBOUNCE_TIME);
    
    return () => {
      if (fetchRef.current) {
        clearTimeout(fetchRef.current);
      }
    };
  }, [dateRange, fetchData]);

  // Color generator
  const getRandomColor = (seed) => {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
    ];
    
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Handler date change – cuma update temp, ga nge-fetch
  const handleDateChange = (type, value) => {
    let newTempDateRange = {
      ...tempDateRange,
      [type]: value,
    };

    // Biar nggak start > end, tapi tetep tanpa limit di kalender
    if (type === 'end') {
      const startDate = newTempDateRange.start ? new Date(newTempDateRange.start) : null;
      const endDate = value ? new Date(value) : null;
      if (startDate && endDate && endDate < startDate) {
        newTempDateRange.start = value;
      }
    }

    if (type === 'start') {
      const endDate = newTempDateRange.end ? new Date(newTempDateRange.end) : null;
      const startDate = value ? new Date(value) : null;
      if (startDate && endDate && startDate > endDate) {
        newTempDateRange.end = value;
      }
    }

    setTempDateRange(newTempDateRange);
  };

  // Apply filter: baru di sini dateRange berubah → baru fetch
  const applyDateFilter = () => {
    if (!tempDateRange.start || !tempDateRange.end) return;
    setDateRange(tempDateRange);
  };

  const resetToCurrentMonth = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const newDateRange = {
      start: firstDayOfMonth.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
    
    setTempDateRange(newDateRange);
    setDateRange(newDateRange);
  };

  // Summary
  const calculateSummary = useCallback(() => {
    let income = 0, expense = 0;
    let incomeCount = 0, expenseCount = 0;
    
    transactions.forEach(transaction => {
      if (transaction.type === 'income') {
        income += parseFloat(transaction.amount);
        incomeCount++;
      } else {
        expense += parseFloat(transaction.amount);
        expenseCount++;
      }
    });
    
    return { 
      income, 
      expense, 
      total: income - expense,
      incomeCount,
      expenseCount,
      savingsRate: income > 0 ? ((income - expense) / income * 100) : 0,
      ratio: expense > 0 ? (income / expense).toFixed(2) : '∞'
    };
  }, [transactions]);

  const summary = calculateSummary();

  // Combined pie data
  const getCombinedPieChartData = useCallback(() => {
    const categoryData = new Map();
    
    transactions.forEach(transaction => {
      if (transaction.categories) {
        const categoryName = transaction.categories.name || 'Uncategorized';
        const type = transaction.type;
        const amount = parseFloat(transaction.amount);
        
        if (!categoryData.has(categoryName)) {
          categoryData.set(categoryName, {
            name: categoryName,
            income: 0,
            expense: 0,
            total: 0,
            color: transaction.categories.color || getRandomColor(categoryName),
            count: 0
          });
        }
        
        const category = categoryData.get(categoryName);
        if (type === 'income') {
          category.income += amount;
        } else {
          category.expense += amount;
        }
        category.total += amount;
        category.count += 1;
      }
    });
    
    const result = Array.from(categoryData.values())
      .filter(item => item.total > 0)
      .map(item => ({
        ...item,
        value: item.total,
        displayName: item.name,
        type: item.income > item.expense ? 'income' : 'expense'
      }))
      .sort((a, b) => b.total - a.total);
    
    return result;
  }, [transactions]);

  // Bar data
  const getBarChartData = useCallback(() => {
    const categoryData = new Map();
    
    transactions.forEach(transaction => {
      if (transaction.categories) {
        const categoryName = transaction.categories.name || 'Uncategorized';
        const type = transaction.type;
        const amount = parseFloat(transaction.amount);
        
        if (!categoryData.has(categoryName)) {
          categoryData.set(categoryName, {
            name: categoryName.length > 15 ? categoryName.substring(0, 12) + '...' : categoryName,
            income: 0,
            expense: 0,
            net: 0
          });
        }
        
        const category = categoryData.get(categoryName);
        if (type === 'income') {
          category.income += amount;
        } else {
          category.expense += amount;
        }
        category.net = category.income - category.expense;
      }
    });
    
    return Array.from(categoryData.values())
      .filter(item => item.income > 0 || item.expense > 0)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 8);
  }, [transactions]);

  // Type pie data
  const getTypePieChartData = useCallback(() => {
    const data = new Map();
    
    transactions.forEach(transaction => {
      if (transaction.type === chartType && transaction.categories) {
        const categoryName = transaction.categories.name || 'Uncategorized';
        const amount = parseFloat(transaction.amount);
        
        if (!data.has(categoryName)) {
          data.set(categoryName, {
            name: categoryName,
            value: 0,
            color: transaction.categories.color || getRandomColor(categoryName),
            count: 0,
            type: chartType
          });
        }
        
        const category = data.get(categoryName);
        category.value += amount;
        category.count += 1;
      }
    });
    
    const result = Array.from(data.values())
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
    
    if (result.length > (screenInfo.isMobile ? 5 : 8)) {
      const mainCategories = result.slice(0, screenInfo.isMobile ? 4 : 7);
      const otherCategories = result.slice(screenInfo.isMobile ? 4 : 7);
      const otherTotal = otherCategories.reduce((sum, cat) => sum + cat.value, 0);
      const otherCount = otherCategories.reduce((sum, cat) => sum + cat.count, 0);
      
      mainCategories.push({
        name: 'Other',
        value: otherTotal,
        color: '#94a3b8',
        count: otherCount,
        type: chartType
      });
      
      return mainCategories;
    }
    
    return result;
  }, [transactions, chartType, screenInfo.isMobile]);

  const pieChartData = chartType === 'combined' ? getCombinedPieChartData() : getTypePieChartData();
  const barChartData = getBarChartData();

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = chartType === 'combined' 
        ? summary.income + summary.expense 
        : chartType === 'expense' 
          ? summary.expense 
          : summary.income;
      
      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      
      return (
        <div style={styles.tooltip}>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px' }}>{data.name}</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px' }}>
            Amount: {formatCurrency(data.value)}
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>
            Percentage: <strong>{percentage}%</strong>
          </p>
          {data.count && (
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>
              Transactions: {data.count}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom label – cuma persen putih kecil
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const pct = (percent * 100).toFixed(0);

    if (pct <= 0) return null;

    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        fontSize={10}
        fontWeight="600"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {`${pct}%`}
      </text>
    );
  };

  const isMobile = screenInfo.isMobile;
  const isLandscape = screenInfo.isLandscape;
  const isTablet = screenInfo.isTablet;

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading reports...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Financial Reports</h2>
        <div style={styles.dateRangeContainer}>
          <div style={styles.dateRange}>
            <div style={styles.dateInputGroup}>
              <label style={styles.dateLabel}>From</label>
              <input
                type="date"
                value={tempDateRange.start}
                onChange={(e) => handleDateChange('start', e.target.value)}
                style={styles.dateInput}
              />
            </div>
            <div style={styles.dateSeparator}></div>
            <div style={styles.dateInputGroup}>
              <label style={styles.dateLabel}>To</label>
              <input
                type="date"
                value={tempDateRange.end}
                onChange={(e) => handleDateChange('end', e.target.value)}
                style={styles.dateInput}
              />
            </div>
            <button
              onClick={applyDateFilter}
              style={styles.applyButton}
              title="Apply date filter"
            >
              Apply
            </button>
            <button
              onClick={resetToCurrentMonth}
              style={styles.resetButton}
              title="Reset to current month"
            >
              ↻
            </button>
          </div>
          <div style={styles.dateInfo}>
            <span style={styles.dateText}>
              Showing {transactions.length} transactions
            </span>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{
        ...styles.summaryCards,
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '10px' : '15px'
      }}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Total Income</h3>
          <p style={{...styles.amount, color: '#10B981', fontSize: isMobile ? '18px' : '24px'}}>
            {formatCurrency(summary.income)}
          </p>
          <p style={styles.transactionCount}>
            {summary.incomeCount} transactions
          </p>
        </div>
        
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Total Expenses</h3>
          <p style={{...styles.amount, color: '#EF4444', fontSize: isMobile ? '18px' : '24px'}}>
            {formatCurrency(summary.expense)}
          </p>
          <p style={styles.transactionCount}>
            {summary.expenseCount} transactions
          </p>
        </div>
        
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Net Balance</h3>
          <p style={{
            ...styles.amount,
            color: summary.total >= 0 ? '#10B981' : '#EF4444',
            fontSize: isMobile ? '18px' : '24px'
          }}>
            {formatCurrency(summary.total)}
          </p>
          <p style={styles.transactionCount}>
            {summary.total >= 0 ? 'Surplus' : 'Deficit'}
          </p>
        </div>
        
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Total</h3>
          <p style={{...styles.amount, color: '#3B82F6', fontSize: isMobile ? '18px' : '24px'}}>
            {transactions.length}
          </p>
          <p style={styles.transactionCount}>
            Transactions
          </p>
        </div>
      </div>

      {/* Insights */}
      <div style={styles.insights}>
        <h3 style={styles.insightsTitle}>Financial Insights</h3>
        <div style={{
          ...styles.insightsGrid,
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? '10px' : '15px'
        }}>
          <div style={styles.insightItem}>
            <span style={styles.insightLabel}>Savings Rate</span>
            <span style={{
              ...styles.insightValue,
              color: summary.savingsRate >= 20 ? '#10B981' : 
                     summary.savingsRate >= 10 ? '#F59E0B' : '#EF4444'
            }}>
              {summary.savingsRate.toFixed(1)}%
            </span>
          </div>
          <div style={styles.insightItem}>
            <span style={styles.insightLabel}>Income/Expense</span>
            <span style={styles.insightValue}>
              {summary.ratio} : 1
            </span>
          </div>
          <div style={styles.insightItem}>
            <span style={styles.insightLabel}>Daily Avg</span>
            <span style={styles.insightValue}>
              {formatCurrency(summary.expense / 30)}
            </span>
          </div>
          <div style={styles.insightItem}>
            <span style={styles.insightLabel}>Status</span>
            <span style={{
              ...styles.insightValue,
              color: summary.total >= 0 ? '#10B981' : '#EF4444'
            }}>
              {summary.total >= 0 ? 'Healthy' : 'Review'}
            </span>
          </div>
        </div>
      </div>

      {/* Chart section */}
      <div style={styles.section}>
        <div style={styles.chartHeader}>
          <h3 style={styles.sectionTitle}>Financial Analysis</h3>
          <div style={{
            ...styles.chartToggle,
            flexDirection: isMobile ? 'column' : 'row'
          }}>
            <button
              onClick={() => setChartType('combined')}
              style={{
                ...styles.toggleButton,
                backgroundColor: chartType === 'combined' ? '#3b82f6' : '#f1f5f9',
                color: chartType === 'combined' ? 'white' : '#475569',
                fontSize: isMobile ? '13px' : '14px',
                padding: isMobile ? '8px 12px' : '8px 16px'
              }}
            >
              Combined
            </button>
            <button
              onClick={() => setChartType('expense')}
              style={{
                ...styles.toggleButton,
                backgroundColor: chartType === 'expense' ? '#ef4444' : '#f1f5f9',
                color: chartType === 'expense' ? 'white' : '#475569',
                fontSize: isMobile ? '13px' : '14px',
                padding: isMobile ? '8px 12px' : '8px 16px'
              }}
            >
              Expenses
            </button>
            <button
              onClick={() => setChartType('income')}
              style={{
                ...styles.toggleButton,
                backgroundColor: chartType === 'income' ? '#10b981' : '#f1f5f9',
                color: chartType === 'income' ? 'white' : '#475569',
                fontSize: isMobile ? '13px' : '14px',
                padding: isMobile ? '8px 12px' : '8px 16px'
              }}
            >
              Income
            </button>
          </div>
        </div>

        {pieChartData.length > 0 ? (
          <div style={{
            ...styles.chartSection,
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '15px' : '20px',
            minHeight: isMobile ? '260px' : '320px',
          }}>
            {/* Bar chart (hidden di mobile portrait) */}
            {(!isMobile || isLandscape) && (
              <div style={{
                ...styles.chartColumn,
                flex: isTablet ? 1 : 1,
                display: isMobile && !isLandscape ? 'none' : 'flex'
              }}>
                <div style={styles.barChartContainer}>
                  <h4 style={styles.chartTitle}>Top Categories</h4>
                  <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
                    <BarChart
                      data={barChartData}
                      margin={{ 
                        top: 20, 
                        right: isMobile ? 10 : 30, 
                        left: 0, 
                        bottom: isMobile ? 40 : 50 
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={isMobile ? 50 : 60}
                        fontSize={isMobile ? 10 : 11}
                      />
                      <YAxis 
                        tickFormatter={(value) => `Rp${(value/1000).toFixed(0)}k`}
                        fontSize={isMobile ? 10 : 11}
                      />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === 'income') return [formatCurrency(value), 'Income'];
                          if (name === 'expense') return [formatCurrency(value), 'Expense'];
                          return [formatCurrency(value), name];
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="income" 
                        fill="#10b981" 
                        name="Income"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="expense" 
                        fill="#ef4444" 
                        name="Expense"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <p style={styles.chartNote}>
                    Top 8 categories by net amount
                  </p>
                </div>
              </div>
            )}

            {/* Pie chart */}
            <div style={{
              ...styles.chartColumn,
              flex: isMobile ? 1 : 1.2,
              minHeight: isMobile ? '220px' : '260px',
            }}>
              <div style={styles.pieChartContainer}>
                <h4 style={styles.chartTitle}>
                  {chartType === 'combined' ? 'Income & Expenses' : 
                   chartType === 'expense' ? 'Expenses by Category' : 'Income by Category'}
                </h4>

                {isMobile ? (
                  <PieChart width={260} height={260}>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderPieLabel}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderPieLabel}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Summary + Top categories */}
            <div style={{
              ...styles.chartColumn,
              flex: 1,
              marginTop: isMobile ? '10px' : 0,
            }}>
              <div style={styles.summaryContainer}>
                <h4 style={styles.chartTitle}>Summary</h4>
                <div style={styles.summaryBox}>
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Income:</span>
                    <span style={{...styles.summaryValue, color: '#10B981'}}>
                      {formatCurrency(summary.income)}
                    </span>
                  </div>
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Expenses:</span>
                    <span style={{...styles.summaryValue, color: '#EF4444'}}>
                      {formatCurrency(summary.expense)}
                    </span>
                  </div>
                  <div style={styles.divider}></div>
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Net:</span>
                    <span style={{
                      ...styles.summaryValue,
                      color: summary.total >= 0 ? '#10B981' : '#EF4444',
                      fontWeight: '700'
                    }}>
                      {formatCurrency(summary.total)}
                    </span>
                  </div>
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Savings:</span>
                    <span style={{
                      ...styles.summaryValue,
                      color: summary.savingsRate >= 20 ? '#10B981' : 
                             summary.savingsRate >= 10 ? '#F59E0B' : '#EF4444'
                    }}>
                      {summary.savingsRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                {pieChartData.length > 0 && (
                  <>
                    <h4 style={{...styles.chartTitle, marginTop: '15px', fontSize: '15px'}}>
                      Top Categories
                    </h4>
                    <div style={styles.categoryList}>
                      {pieChartData
                        .slice(0, isMobile ? 3 : 5)
                        .map((item, index) => {
                          const total = chartType === 'combined' 
                            ? summary.income + summary.expense 
                            : chartType === 'expense' 
                              ? summary.expense 
                              : summary.income;
                          
                          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                          
                          return (
                            <div key={index} style={styles.categoryItem}>
                              <div style={styles.categoryHeader}>
                                <div style={styles.categoryColor}>
                                  <div style={{ 
                                    ...styles.colorDot, 
                                    backgroundColor: item.color 
                                  }} />
                                  <span style={{
                                    ...styles.categoryName,
                                    fontSize: isMobile ? '12px' : '13px'
                                  }}>
                                    {item.name.length > 15 ? item.name.substring(0, 12) + '...' : item.name}
                                  </span>
                                </div>
                                <span style={{
                                  ...styles.categoryAmount,
                                  fontSize: isMobile ? '12px' : '13px'
                                }}>
                                  {formatCurrency(item.value)}
                                </span>
                              </div>
                              <div style={styles.categoryMeta}>
                                <span style={styles.categoryPercentage}>
                                  {percentage}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.noData}>
            <div style={styles.noDataIcon}>📊</div>
            <p>No transaction data available for selected period</p>
          </div>
        )}

        {/* Mobile bottom bar */}
        {isMobile && !isLandscape && pieChartData.length > 0 && (
          <div style={styles.mobileBottomBar}>
            <div style={styles.mobileBottomStats}>
              <div style={styles.mobileBottomStat}>
                <span style={styles.mobileBottomLabel}>Net</span>
                <span style={{
                  ...styles.mobileBottomValue,
                  color: summary.total >= 0 ? '#10B981' : '#EF4444'
                }}>
                  {formatCurrency(summary.total)}
                </span>
              </div>
              <div style={styles.mobileBottomStat}>
                <span style={styles.mobileBottomLabel}>Savings</span>
                <span style={{
                  ...styles.mobileBottomValue,
                  color: summary.savingsRate >= 20 ? '#10B981' : 
                         summary.savingsRate >= 10 ? '#F59E0B' : '#EF4444'
                }}>
                  {summary.savingsRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Recent Transactions</h3>
          <button 
            onClick={() => alert('View all transactions in dashboard')}
            style={styles.viewAllButton}
          >
            View All
          </button>
        </div>
        {transactions.length === 0 ? (
          <div style={styles.noData}>
            <div style={styles.noDataIcon}>📋</div>
            <p>No transactions in selected date range</p>
          </div>
        ) : (
          <div style={styles.transactionList}>
            {transactions.slice(0, isMobile ? 3 : 5).map(transaction => (
              <div key={transaction.id} style={styles.transactionItem}>
                <div style={styles.transactionLeft}>
                  <div style={{
                    ...styles.transactionType,
                    backgroundColor: transaction.type === 'income' ? '#10B981' : '#EF4444',
                    fontSize: isMobile ? '12px' : '14px',
                    width: isMobile ? '28px' : '32px',
                    height: isMobile ? '28px' : '32px'
                  }}>
                    {transaction.type === 'income' ? 'I' : 'E'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      ...styles.transactionDesc,
                      fontSize: isMobile ? '13px' : '14px'
                    }}>
                      {transaction.description || 'No description'}
                    </p>
                    <p style={{
                      ...styles.transactionMeta,
                      fontSize: isMobile ? '11px' : '12px'
                    }}>
                      {new Date(transaction.date).toLocaleDateString('id-ID')} • 
                      {transaction.categories?.name || 'Uncategorized'}
                    </p>
                  </div>
                </div>
                <div style={styles.transactionRight}>
                  <p style={{
                    ...styles.transactionAmount,
                    fontSize: isMobile ? '14px' : '16px',
                    color: transaction.type === 'income' ? '#10B981' : '#EF4444'
                  }}>
                    {transaction.type === 'income' ? '+' : '-'} 
                    {formatCurrency(transaction.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div style={styles.exportSection}>
        <button onClick={exportToCSV} style={styles.exportButton}>
          Export CSV ({transactions.length} transactions)
        </button>
      </div>
    </div>
  );

  function exportToCSV() {
    if (transactions.length === 0) {
      alert('No transactions to export');
      return;
    }

    const headers = ['Date', 'Type', 'Category', 'Amount', 'Description'];
    const rows = transactions.map(t => {
      const date = new Date(t.date).toISOString().split('T')[0];
      const type = t.type;
      const category = t.categories?.name || '-';
      const amount = t.amount;
      const description = t.description ? `"${t.description.replace(/"/g, '""')}"` : '';
      
      return [date, type, category, amount, description];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `report-${new Date().toISOString().split('T')[0]}.csv`;
    
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert(`Exported ${transactions.length} transactions`);
  }
}

// Styles
const styles = {
  container: {
    backgroundColor: 'white',
    padding: '15px',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
  },
  dateRangeContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '100%',
  },
  dateRange: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    flexWrap: 'wrap',
  },
  dateInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minWidth: '120px',
  },
  dateLabel: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: '500',
  },
  dateInput: {
    padding: '10px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#f8fafc',
    transition: 'all 0.2s ease',
    height: '42px',
    boxSizing: 'border-box',
  },
  dateSeparator: {
    width: '16px',
    height: '2px',
    backgroundColor: '#cbd5e1',
    marginTop: '12px',
  },
  applyButton: {
    backgroundColor: '#3b82f6',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    color: 'white',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    height: '42px',
    padding: '0 16px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#475569',
    transition: 'all 0.2s ease',
    height: '42px',
    padding: '0 14px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateInfo: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  dateText: {
    fontSize: '12px',
    color: '#64748b',
    fontStyle: 'italic',
  },
  summaryCards: {
    display: 'grid',
    marginBottom: '20px',
  },
  card: {
    padding: '15px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    textAlign: 'center',
    backgroundColor: '#f8fafc',
  },
  cardTitle: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
  },
  amount: {
    fontWeight: '800',
    margin: '8px 0',
  },
  transactionCount: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px',
  },
  insights: {
    backgroundColor: '#f0f9ff',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #bae6fd',
  },
  insightsTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: '700',
    color: '#0369a1',
  },
  insightsGrid: {
    display: 'grid',
    gap: '12px',
  },
  insightItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  insightLabel: {
    fontSize: '12px',
    color: '#475569',
    fontWeight: '500',
  },
  insightValue: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#1e293b',
  },
  section: {
    marginBottom: '25px',
    position: 'relative',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: '#1e293b',
  },
  viewAllButton: {
    backgroundColor: 'transparent',
    color: '#3b82f6',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  chartHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '15px',
  },
  chartToggle: {
    display: 'flex',
    gap: '8px',
  },
  toggleButton: {
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    flex: 1,
  },
  tooltip: {
    backgroundColor: 'white',
    padding: '8px',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    border: '1px solid #e2e8f0',
    fontSize: '11px',
    maxWidth: '200px',
  },
  chartSection: {
    display: 'flex',
    backgroundColor: '#f8fafc',
    padding: '15px',
    borderRadius: '8px',
    width: '100%',
    boxSizing: 'border-box',
  },
  chartColumn: {
    display: 'flex',
    flexDirection: 'column',
  },
  barChartContainer: {
    backgroundColor: 'white',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    height: '100%',
    width: '100%',
  },
  pieChartContainer: {
    backgroundColor: 'white',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    height: '100%',
    width: '100%',
  },
  summaryContainer: {
    backgroundColor: 'white',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    height: '100%',
    width: '100%',
  },
  chartTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  chartNote: {
    fontSize: '11px',
    color: '#64748b',
    textAlign: 'center',
    marginTop: '8px',
    fontStyle: 'italic',
  },
  summaryBox: {
    backgroundColor: '#f8fafc',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '15px',
  },
  summaryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#475569',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1e293b',
  },
  divider: {
    height: '1px',
    backgroundColor: '#e2e8f0',
    margin: '10px 0',
  },
  categoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  categoryItem: {
    backgroundColor: '#f8fafc',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
  },
  categoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  categoryColor: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  colorDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  categoryName: {
    fontWeight: '500',
    color: '#334155',
  },
  categoryAmount: {
    fontWeight: '600',
    color: '#1e293b',
  },
  categoryMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#64748b',
  },
  categoryPercentage: {
    backgroundColor: '#e2e8f0',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  mobileBottomBar: {
    marginTop: '15px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  mobileBottomStats: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  mobileBottomStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  mobileBottomLabel: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: '500',
  },
  mobileBottomValue: {
    fontSize: '14px',
    fontWeight: '700',
  },
  transactionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  transactionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
  },
  transactionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
  },
  transactionType: {
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '600',
    flexShrink: 0,
  },
  transactionDesc: {
    margin: '0 0 4px 0',
    fontWeight: '500',
    color: '#1e293b',
  },
  transactionMeta: {
    margin: 0,
    color: '#64748b',
  },
  transactionRight: {
    marginLeft: '8px',
  },
  transactionAmount: {
    margin: 0,
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  noData: {
    textAlign: 'center',
    color: '#64748b',
    padding: '30px 20px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    fontSize: '14px',
  },
  noDataIcon: {
    fontSize: '32px',
    marginBottom: '10px',
    opacity: 0.5,
  },
  exportSection: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '20px',
    paddingBottom: '20px',
  },
  exportButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s ease',
    width: '100%',
    maxWidth: '300px',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    textAlign: 'center',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #f1f5f9',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '15px',
  },
};

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
    
    input[type="date"]::-webkit-calendar-picker-indicator {
      padding: 4px;
      margin: 0;
    }
    
    input[type="date"] {
      font-size: 16px !important;
    }
  `;
  document.head.appendChild(style);
}

export default Reports;
