import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Bar, Pie, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

function Reports() {
  const [reportData, setReportData] = useState({
    monthlyData: [],
    categoryData: [],
    incomeExpenseData: []
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get transactions for date range
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .eq('user_id', user.id)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      // Get categories
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id);

      // Process data
      const monthly = processMonthlyData(transactions);
      const byCategory = processCategoryData(transactions, categories);
      const incomeExpense = processIncomeExpenseData(transactions);

      setReportData({
        monthlyData: monthly,
        categoryData: byCategory,
        incomeExpenseData: incomeExpense
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processMonthlyData = (transactions) => {
    const monthly = {};
    
    transactions?.forEach(transaction => {
      const month = new Date(transaction.date).toLocaleDateString('id-ID', { month: 'short' });
      if (!monthly[month]) monthly[month] = { income: 0, expense: 0 };
      
      if (transaction.type === 'income') {
        monthly[month].income += parseFloat(transaction.amount);
      } else {
        monthly[month].expense += parseFloat(transaction.amount);
      }
    });

    return Object.entries(monthly).map(([month, data]) => ({
      month,
      ...data
    }));
  };

  const processCategoryData = (transactions, categories) => {
    const categoryMap = {};
    
    categories?.forEach(cat => {
      categoryMap[cat.id] = { name: cat.name, color: cat.color, total: 0 };
    });

    transactions?.forEach(transaction => {
      if (transaction.category_id && categoryMap[transaction.category_id]) {
        categoryMap[transaction.category_id].total += parseFloat(transaction.amount);
      }
    });

    return Object.values(categoryMap)
      .filter(cat => cat.total > 0)
      .sort((a, b) => b.total - a.total);
  };

  const processIncomeExpenseData = (transactions) => {
    let income = 0, expense = 0;
    
    transactions?.forEach(transaction => {
      if (transaction.type === 'income') {
        income += parseFloat(transaction.amount);
      } else {
        expense += parseFloat(transaction.amount);
      }
    });

    return { income, expense };
  };

  const barChartData = {
    labels: reportData.monthlyData.map(d => d.month),
    datasets: [
      {
        label: 'Income',
        data: reportData.monthlyData.map(d => d.income),
        backgroundColor: '#10B981',
      },
      {
        label: 'Expense',
        data: reportData.monthlyData.map(d => d.expense),
        backgroundColor: '#EF4444',
      },
    ],
  };

  const pieChartData = {
    labels: reportData.categoryData.map(d => d.name),
    datasets: [
      {
        data: reportData.categoryData.map(d => d.total),
        backgroundColor: reportData.categoryData.map(d => d.color),
        borderWidth: 1,
      },
    ],
  };

  const incomeExpenseData = {
    labels: ['Income', 'Expense'],
    datasets: [
      {
        data: [reportData.incomeExpenseData.income, reportData.incomeExpenseData.expense],
        backgroundColor: ['#10B981', '#EF4444'],
        borderWidth: 1,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Monthly Income vs Expense',
      },
    },
  };

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Spending by Category',
      },
    },
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Financial Reports</h2>
        <div style={styles.dateRange}>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            style={styles.dateInput}
          />
          <span>to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            style={styles.dateInput}
          />
        </div>
      </div>

      <div style={styles.chartsGrid}>
        <div style={styles.chartCard}>
          <Bar data={barChartData} options={barOptions} />
        </div>
        
        <div style={styles.chartCard}>
          <Pie data={pieChartData} options={pieOptions} />
        </div>
        
        <div style={styles.chartCard}>
          <h3>Income vs Expense</h3>
          <div style={styles.summaryStats}>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Total Income:</span>
              <span style={{...styles.statValue, color: '#10B981'}}>
                Rp {reportData.incomeExpenseData.income.toLocaleString('id-ID')}
              </span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Total Expense:</span>
              <span style={{...styles.statValue, color: '#EF4444'}}>
                Rp {reportData.incomeExpenseData.expense.toLocaleString('id-ID')}
              </span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Net Balance:</span>
              <span style={{...styles.statValue, 
                color: (reportData.incomeExpenseData.income - reportData.incomeExpenseData.expense) >= 0 ? '#10B981' : '#EF4444'
              }}>
                Rp {(reportData.incomeExpenseData.income - reportData.incomeExpenseData.expense).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.exportSection}>
        <button style={styles.exportButton} onClick={() => exportToCSV()}>
          Export to CSV
        </button>
        <button style={styles.printButton} onClick={() => window.print()}>
          Print Report
        </button>
      </div>
    </div>
  );
}

const exportToCSV = () => {
  alert('CSV export feature would be implemented here');
};

const styles = {
  container: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
  },
  dateRange: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  dateInput: {
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '30px',
    marginBottom: '30px',
  },
  chartCard: {
    padding: '20px',
    border: '1px solid #eee',
    borderRadius: '8px',
    minHeight: '300px',
  },
  summaryStats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    marginTop: '20px',
  },
  statItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #f0f0f0',
  },
  statLabel: {
    fontSize: '16px',
    color: '#666',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 'bold',
  },
  exportSection: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    marginTop: '30px',
  },
  exportButton: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  printButton: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '50px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px',
  },
};

export default Reports;