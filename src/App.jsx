import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import AuthForm from './components/AuthForm';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import Reports from './components/Reports';
import CategoryManager from './components/CategoryManager';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [summary, setSummary] = useState({ total: 0, income: 0, expense: 0 });
  const [activeView, setActiveView] = useState('dashboard');

  useEffect(() => {
    // Check session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      calculateSummary();
    }
  }, [session, refreshTrigger]);

  const calculateSummary = async () => {
    try {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, type');
      
      let income = 0, expense = 0;
      transactions?.forEach(t => {
        if (t.type === 'income') income += parseFloat(t.amount);
        else expense += parseFloat(t.amount);
      });
      
      setSummary({
        income,
        expense,
        total: income - expense
      });
    } catch (error) {
      console.error('Error calculating summary:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleTransactionSaved = () => {
    setShowTransactionForm(false);
    setEditingTransaction(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  if (!session) {
    return <AuthForm />;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Expense Tracker</h1>
        <div style={styles.userSection}>
          {activeView !== 'dashboard' && (
            <button 
              onClick={() => setActiveView('dashboard')}
              style={styles.backButton}
            >
              ← Dashboard
            </button>
          )}
          <span style={styles.userEmail}>{session.user.email}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {activeView === 'categories' ? (
          <CategoryManager onBack={() => setActiveView('dashboard')} />
        ) : activeView === 'reports' ? (
          <Reports />
        ) : (
          <>
            {showTransactionForm && (
              <div style={{ marginBottom: '30px', maxWidth: '500px', margin: '0 auto 30px' }}>
                <TransactionForm
                  transaction={editingTransaction}
                  onSave={handleTransactionSaved}
                  onCancel={() => {
                    setShowTransactionForm(false);
                    setEditingTransaction(null);
                  }}
                />
              </div>
            )}

            <div style={styles.statsGrid}>
              <div style={styles.card}>
                <h3>Total Balance</h3>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
                  {formatCurrency(summary.total)}
                </p>
              </div>
              <div style={styles.card}>
                <h3>Income</h3>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'green' }}>
                  {formatCurrency(summary.income)}
                </p>
              </div>
              <div style={styles.card}>
                <h3>Expenses</h3>
                <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'red' }}>
                  {formatCurrency(summary.expense)}
                </p>
              </div>
            </div>

            <div style={styles.actions}>
              <h2>Quick Actions</h2>
              <div style={styles.buttonGroup}>
                <button 
                  onClick={() => setShowTransactionForm(true)}
                  style={styles.primaryBtn}
                >
                  Add Transaction
                </button>
                <button 
                  onClick={() => setActiveView('reports')}
                  style={styles.secondaryBtn}
                >
                  View Reports
                </button>
                <button
                  onClick={() => setActiveView('categories')}
                  style={styles.secondaryBtn}
                >
                  Manage Categories
                </button>
              </div>
            </div>

            <TransactionList 
              refreshTrigger={refreshTrigger}
              onEdit={(transaction) => {
                setEditingTransaction(transaction);
                setShowTransactionForm(true);
              }}
            />
          </>
        )}
      </main>

      <footer style={styles.footer}>
        <p>Developed by Raya Sesan - 51423249</p>
      </footer>
    </div>
  );
}

const styles = {
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    width: '100vw',
  },
  container: {
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: '#f8f9fa',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    backgroundColor: 'white',
    padding: '20px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    width: '100%',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    color: '#1a1a1a',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  backButton: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  userEmail: {
    fontSize: '14px',
    color: '#666',
    backgroundColor: '#f8f9fa',
    padding: '8px 12px',
    borderRadius: '20px',
  },
  logoutBtn: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  main: {
    padding: '40px',
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '25px',
    marginBottom: '40px',
    width: '100%',
  },
  card: {
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    textAlign: 'center',
    transition: 'transform 0.3s ease',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
  },
  actions: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    marginBottom: '40px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    width: '100%',
    boxSizing: 'border-box',
  },
  buttonGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginTop: '25px',
    width: '100%',
  },
  primaryBtn: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '18px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'background-color 0.3s',
    width: '100%',
  },
  secondaryBtn: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '18px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'background-color 0.3s',
    width: '100%',
  },
  footer: {
    backgroundColor: '#343a40',
    color: 'white',
    textAlign: 'center',
    padding: '25px',
    marginTop: '60px',
    fontSize: '14px',
    width: '100vw',
  },
};

export default App;