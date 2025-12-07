import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function TransactionList({ refreshTrigger, onEdit }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState({});

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  const fetchData = async () => {
    setLoading(true);
    
    try {
      // Fetch transactions
      const { data: transactionsData, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(20);
      
      if (transError) throw transError;
      
      // Fetch categories for mapping
      const { data: categoriesData, error: catError } = await supabase
        .from('categories')
        .select('*');
      
      if (catError) throw catError;
      
      // Convert categories to map
      const catMap = {};
      categoriesData.forEach(cat => {
        catMap[cat.id] = cat;
      });
      
      setTransactions(transactionsData || []);
      setCategories(catMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      alert('Transaction deleted!');
      fetchData();
    } catch (error) {
      alert('Delete failed: ' + error.message);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading transactions...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>No transactions yet</p>
        <p style={styles.emptySubText}>Add your first transaction above!</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Recent Transactions ({transactions.length})</h3>
      </div>
      
      <div style={styles.transactionList}>
        {transactions.map(transaction => {
          const category = categories[transaction.category_id];
          const isIncome = transaction.type === 'income';
          
          return (
            <div key={transaction.id} style={styles.transactionItem}>
              <div style={styles.transactionMain}>
                <div style={styles.transactionLeft}>
                  <div style={styles.transactionDesc}>
                    {transaction.description || 'No description'}
                  </div>
                  <div style={styles.transactionMeta}>
                    <span style={styles.transactionDate}>
                      {formatDate(transaction.date)}
                    </span>
                    {category && (
                      <span style={{
                        ...styles.categoryBadge,
                        backgroundColor: category.color + '20',
                        color: category.color
                      }}>
                        {category.name}
                      </span>
                    )}
                  </div>
                </div>
                
                <div style={styles.transactionRight}>
                  <div style={{
                    ...styles.amount,
                    color: isIncome ? '#10B981' : '#EF4444'
                  }}>
                    {isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}
                  </div>
                  
                  <div style={styles.actions}>
                    <button
                      onClick={() => onEdit(transaction)}
                      style={styles.editButton}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      style={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    marginTop: '20px'
  },
  header: {
    padding: '20px 25px',
    borderBottom: '1px solid #f1f5f9'
  },
  title: {
    margin: 0,
    color: '#1e293b',
    fontSize: '20px'
  },
  loading: {
    padding: '50px 20px',
    textAlign: 'center',
    color: '#64748b'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 15px'
  },
  empty: {
    padding: '50px 20px',
    textAlign: 'center',
    color: '#94a3b8'
  },
  emptyText: {
    fontSize: '18px',
    marginBottom: '5px'
  },
  emptySubText: {
    fontSize: '14px'
  },
  transactionList: {
    padding: '0'
  },
  transactionItem: {
    padding: '20px 25px',
    borderBottom: '1px solid #f1f5f9',
    transition: 'background-color 0.2s'
  },
  transactionMain: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px'
  },
  transactionLeft: {
    flex: 1
  },
  transactionDesc: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: '5px'
  },
  transactionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  transactionDate: {
    fontSize: '14px',
    color: '#64748b'
  },
  categoryBadge: {
    fontSize: '12px',
    padding: '3px 10px',
    borderRadius: '12px',
    fontWeight: '500'
  },
  transactionRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '10px'
  },
  amount: {
    fontSize: '18px',
    fontWeight: '600'
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  editButton: {
    padding: '6px 12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  deleteButton: {
    padding: '6px 12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer'
  }
};

// Add CSS animation
const styleSheet = document.styleSheets[0];
const keyframes = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;
styleSheet.insertRule(keyframes, styleSheet.cssRules.length);

export default TransactionList;