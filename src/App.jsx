import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [userStats, setUserStats] = useState({
    transactionCount: 0,
    categoryCount: 0,
    daysActive: 0,
  });
  const [isMobile, setIsMobile] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [isChangingView, setIsChangingView] = useState(false);

  const currentSessionRef = useRef(null);
  const mountedRef = useRef(true);

  // Load Google Fonts sekali di client
  useEffect(() => {
    const link = document.createElement('link');
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Detect mobile / desktop
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ====== FUNGSI: SUMMARY ======
  const calculateSummary = useCallback(async (userId) => {
    if (!userId) return;

    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', userId);

      if (error) throw error;

      let income = 0;
      let expense = 0;

      if (transactions) {
        transactions.forEach((t) => {
          if (t.type === 'income') income += parseFloat(t.amount);
          else expense += parseFloat(t.amount);
        });
      }

      if (mountedRef.current) {
        setSummary({
          income,
          expense,
          total: income - expense,
        });
      }
    } catch (error) {
      console.error('Error calculating summary:', error);
    }
  }, []);

  // ====== FUNGSI: USER STATS ======
  const fetchUserStats = useCallback(async (userId) => {
    if (!userId) return;

    try {
      const [transactionsResult, categoriesResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('categories')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
      ]);

      let daysActive = 1;
      try {
        const { data: firstTransaction, error: dateError } = await supabase
          .from('transactions')
          .select('date')
          .eq('user_id', userId)
          .order('date', { ascending: true })
          .limit(1);

        if (!dateError && firstTransaction && firstTransaction.length > 0) {
          const firstDate = new Date(firstTransaction[0].date);
          const today = new Date();
          const diffTime = Math.abs(today - firstDate);
          daysActive =
            Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        }
      } catch (dateError) {
        console.error('Error calculating days active:', dateError);
      }

      if (mountedRef.current) {
        setUserStats({
          transactionCount: transactionsResult.count || 0,
          categoryCount: categoriesResult.count || 0,
          daysActive,
        });
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  }, []);

  // ====== SESSION CHECK & AUTH LISTENER ======
  useEffect(() => {
    mountedRef.current = true;

    const initializeApp = async () => {
      try {
        // fallback timeout supaya gak loading terus kalau ada masalah
        const timeoutId = setTimeout(() => {
          if (mountedRef.current) {
            setLoading(false);
            setInitialLoad(false);
          }
        }, 800);

        setTimeout(() => {
          if (mountedRef.current && loading) {
            setLoading(false);
          }
        }, 300);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mountedRef.current) return;

        clearTimeout(timeoutId);
        setSession(session);
        currentSessionRef.current = session;

        if (session) {
          Promise.all([
            calculateSummary(session.user.id),
            fetchUserStats(session.user.id),
          ]).finally(() => {
            if (mountedRef.current) {
              setLoading(false);
              setInitialLoad(false);
            }
          });
        } else {
          setLoading(false);
          setInitialLoad(false);
        }
      } catch (error) {
        console.error('Initialization error:', error);
        if (mountedRef.current) {
          setLoading(false);
          setInitialLoad(false);
        }
      }
    };

    initializeApp();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;

      if (session !== currentSessionRef.current) {
        currentSessionRef.current = session;
        setSession(session);

        if (session) {
          calculateSummary(session.user.id);
          fetchUserStats(session.user.id);
        } else {
          setSummary({ total: 0, income: 0, expense: 0 });
          setUserStats({
            transactionCount: 0,
            categoryCount: 0,
            daysActive: 0,
          });
        }
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [calculateSummary, fetchUserStats, loading]);

  // ====== REFRESH SUMMARY & STATS SAAT TRANSAKSI BERUBAH ======
  useEffect(() => {
    if (session?.user?.id && !initialLoad) {
      const timer = setTimeout(() => {
        calculateSummary(session.user.id);
        fetchUserStats(session.user.id);
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [session, refreshTrigger, calculateSummary, fetchUserStats, initialLoad]);

  const handleViewChange = useCallback((view) => {
    setIsChangingView(true);
    setActiveView(view);

    setTimeout(() => {
      setIsChangingView(false);
    }, 100);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      setSession(null);
      currentSessionRef.current = null;
      setSummary({ total: 0, income: 0, expense: 0 });
      setUserStats({
        transactionCount: 0,
        categoryCount: 0,
        daysActive: 0,
      });

      supabase.auth.signOut().catch(console.error);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const handleTransactionSaved = () => {
    setShowTransactionForm(false);
    setEditingTransaction(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // ====== LOADING / AUTH ======
  if (loading && initialLoad) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loader}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthForm onLogin={() => setLoading(true)} />;
  }

  // ====== MAIN UI ======
  return (
    <div style={styles.container}>
      <header style={styles.header} className="header">
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <h1 style={styles.title} className="title">
              {isMobile ? 'MoneyTrack' : 'MoneyTracker'}
            </h1>
          </div>
          {!isMobile && (
            <div style={styles.greeting} className="greeting">
              <span style={styles.greetingText}>{getGreeting()},</span>
              <span style={styles.userName}>
                {session.user.email.split('@')[0]}
              </span>
            </div>
          )}
        </div>

        <div style={styles.headerRight}>
          {!isMobile && (
            <div style={styles.userStats}>
              <div style={styles.statItem}>
                <span style={styles.statNumber}>
                  {userStats.transactionCount}
                </span>
                <span style={styles.statLabel}>Transactions</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statNumber}>{userStats.daysActive}</span>
                <span style={styles.statLabel}>Days</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statNumber}>
                  {userStats.categoryCount}
                </span>
                <span style={styles.statLabel}>Categories</span>
              </div>
            </div>
          )}

          <div style={styles.headerActions}>
            {!isMobile && (
              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setShowTransactionForm(true);
                }}
                style={styles.addTransactionBtn}
                className="addTransactionBtn"
              >
                <span style={styles.plusIcon}>+</span>
                Add Transaction
              </button>
            )}

            <button
              onClick={handleLogout}
              style={styles.logoutBtn}
              className="logoutBtn"
            >
              {isMobile ? 'Logout' : 'Sign Out'}
            </button>
          </div>
        </div>
      </header>

      <nav style={styles.nav} className="nav">
        <div style={styles.navWrapper} className="navWrapper">
          <div style={styles.navContainer} className="navContainer">
            <div style={styles.navButtons} className="navButtons">
              <button
                onClick={() => handleViewChange('dashboard')}
                style={{
                  ...styles.navButton,
                  ...(activeView === 'dashboard'
                    ? styles.navButtonActive
                    : {}),
                }}
                className={`navButton ${
                  activeView === 'dashboard' ? 'navButtonActive' : ''
                }`}
              >
                <div style={styles.navIconContainer} className="navIconContainer">
                  <svg
                    style={styles.navIcon}
                    className="navIcon"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                  </svg>
                </div>
                <span style={styles.navText} className="navText">
                  Dashboard
                </span>
              </button>

              <button
                onClick={() => handleViewChange('reports')}
                style={{
                  ...styles.navButton,
                  ...(activeView === 'reports'
                    ? styles.navButtonActive
                    : {}),
                }}
                className={`navButton ${
                  activeView === 'reports' ? 'navButtonActive' : ''
                }`}
              >
                <div style={styles.navIconContainer} className="navIconContainer">
                  <svg
                    style={styles.navIcon}
                    className="navIcon"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                  </svg>
                </div>
                <span style={styles.navText} className="navText">
                  Reports
                </span>
              </button>

              <button
                onClick={() => handleViewChange('categories')}
                style={{
                  ...styles.navButton,
                  ...(activeView === 'categories'
                    ? styles.navButtonActive
                    : {}),
                }}
                className={`navButton ${
                  activeView === 'categories' ? 'navButtonActive' : ''
                }`}
              >
                <div style={styles.navIconContainer} className="navIconContainer">
                  <svg
                    style={styles.navIcon}
                    className="navIcon"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z" />
                  </svg>
                </div>
                <span style={styles.navText} className="navText">
                  Categories
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main style={styles.main} className="main">
        {showTransactionForm && (
          <div style={styles.modalOverlay}>
            <div
              style={{
                ...styles.modalContent,
                width: isMobile ? '95%' : '500px',
              }}
            >
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>
                  {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
                </h2>
                <button
                  onClick={() => {
                    setShowTransactionForm(false);
                    setEditingTransaction(null);
                  }}
                  style={styles.closeButton}
                >
                  ×
                </button>
              </div>
              <TransactionForm
                transaction={editingTransaction}
                onSave={handleTransactionSaved}
                onCancel={() => {
                  setShowTransactionForm(false);
                  setEditingTransaction(null);
                }}
              />
            </div>
          </div>
        )}

        {isChangingView && (
          <div style={styles.changingViewOverlay}>
            <div style={styles.changingViewSpinner}></div>
          </div>
        )}

        <div style={styles.contentArea} className="contentArea">
          {activeView === 'categories' ? (
            <div className="categories-manager-wrapper">
              <CategoryManager />
            </div>
          ) : activeView === 'reports' ? (
            <Reports />
          ) : (
            <>
              <div
                style={{
                  ...styles.statsGrid,
                  gridTemplateColumns: isMobile
                    ? '1fr'
                    : 'repeat(3, 1fr)',
                }}
                className="statsGrid"
              >
                <div
                  style={styles.summaryCard}
                  className="summaryCard"
                >
                  <div style={styles.cardHeader}>
                    <div style={styles.cardTitleContainer}>
                      <div
                        style={{
                          ...styles.cardIcon,
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        }}
                      >
                        <svg
                          style={styles.cardIconSvg}
                          viewBox="0 0 24 24"
                          fill="#3B82F6"
                        >
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      </div>
                      <h3 style={styles.cardTitle}>Total Balance</h3>
                    </div>
                  </div>
                  <p style={styles.cardAmount}>
                    {formatCurrency(summary.total)}
                  </p>
                  <div style={styles.cardTrend}>
                    <span
                      style={{
                        ...styles.trendIndicator,
                        color:
                          summary.total >= 0 ? '#10B981' : '#EF4444',
                      }}
                    >
                      {summary.total >= 0 ? 'Positive' : 'Negative'}
                    </span>
                  </div>
                </div>

                <div
                  style={styles.summaryCard}
                  className="summaryCard"
                >
                  <div style={styles.cardHeader}>
                    <div style={styles.cardTitleContainer}>
                      <div
                        style={{
                          ...styles.cardIcon,
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        }}
                      >
                        <svg
                          style={styles.cardIconSvg}
                          viewBox="0 0 24 24"
                          fill="#10B981"
                        >
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                      </div>
                      <h3 style={styles.cardTitle}>Total Income</h3>
                    </div>
                  </div>
                  <p
                    style={{
                      ...styles.cardAmount,
                      color: '#10B981',
                    }}
                  >
                    {formatCurrency(summary.income)}
                  </p>
                  <div style={styles.cardProgress}>
                    <div style={styles.progressBar}>
                      <div
                        style={{
                          ...styles.progressFill,
                          width:
                            summary.income > 0 ? '100%' : '0%',
                          backgroundColor: '#10B981',
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div
                  style={styles.summaryCard}
                  className="summaryCard"
                >
                  <div style={styles.cardHeader}>
                    <div style={styles.cardTitleContainer}>
                      <div
                        style={{
                          ...styles.cardIcon,
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        }}
                      >
                        <svg
                          style={styles.cardIconSvg}
                          viewBox="0 0 24 24"
                          fill="#EF4444"
                        >
                          <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
                        </svg>
                      </div>
                      <h3 style={styles.cardTitle}>Total Expenses</h3>
                    </div>
                  </div>
                  <p
                    style={{
                      ...styles.cardAmount,
                      color: '#EF4444',
                    }}
                  >
                    {formatCurrency(summary.expense)}
                  </p>
                  <div style={styles.cardProgress}>
                    <div style={styles.progressBar}>
                      <div
                        style={{
                          ...styles.progressFill,
                          width:
                            summary.expense > 0 ? '100%' : '0%',
                          backgroundColor: '#EF4444',
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.quickStats}>
                <div style={styles.sectionHeader} className="sectionHeader">
                  <h2 style={styles.sectionTitle} className="sectionTitle">
                    Overview
                  </h2>
                </div>
                <div
                  style={{
                    ...styles.statsGridSmall,
                    gridTemplateColumns: isMobile
                      ? 'repeat(2, 1fr)'
                      : 'repeat(4, 1fr)',
                  }}
                  className="statsGridSmall"
                >
                  <div style={styles.statCard} className="statCard">
                    <div
                      style={{
                        ...styles.statIcon,
                        backgroundColor: '#3B82F6',
                      }}
                    >
                      <svg
                        style={styles.statIconSvg}
                        viewBox="0 0 24 24"
                        fill="white"
                      >
                        <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
                      </svg>
                    </div>
                    <div style={styles.statContent}>
                      <p style={styles.statNumberSmall}>
                        {userStats.transactionCount}
                      </p>
                      <p style={styles.statLabelSmall}>
                        Transactions
                      </p>
                    </div>
                  </div>

                  <div style={styles.statCard} className="statCard">
                    <div
                      style={{
                        ...styles.statIcon,
                        backgroundColor: '#10B981',
                      }}
                    >
                      <svg
                        style={styles.statIconSvg}
                        viewBox="0 0 24 24"
                        fill="white"
                      >
                        <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
                      </svg>
                    </div>
                    <div style={styles.statContent}>
                      <p style={styles.statNumberSmall}>
                        {userStats.daysActive}
                      </p>
                      <p style={styles.statLabelSmall}>Days Active</p>
                    </div>
                  </div>

                  <div style={styles.statCard} className="statCard">
                    <div
                      style={{
                        ...styles.statIcon,
                        backgroundColor: '#8B5CF6',
                      }}
                    >
                      <svg
                        style={styles.statIconSvg}
                        viewBox="0 0 24 24"
                        fill="white"
                      >
                        <path d="M7 18h2v-2H7v2zM5 10v4c0 1.1.9 2 2 2h4v2H5c-1.1 0-2-.9-2-2V10h2zm10 0h4c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2h-4v-2h4v-4h-4v-2zm-2-4H5c-1.1 0-2 .9-2 2v4h2V8h10V6z" />
                      </svg>
                    </div>
                    <div style={styles.statContent}>
                      <p style={styles.statNumberSmall}>
                        {userStats.categoryCount}
                      </p>
                      <p style={styles.statLabelSmall}>Categories</p>
                    </div>
                  </div>

                  <div style={styles.statCard} className="statCard">
                    <div
                      style={{
                        ...styles.statIcon,
                        backgroundColor: '#F59E0B',
                      }}
                    >
                      <svg
                        style={styles.statIconSvg}
                        viewBox="0 0 24 24"
                        fill="white"
                      >
                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                      </svg>
                    </div>
                    <div style={styles.statContent}>
                      <p style={styles.statNumberSmall}>24/7</p>
                      <p style={styles.statLabelSmall}>Access</p>
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.transactionSection}>
                <div style={styles.sectionHeader} className="sectionHeader">
                  <h2 style={styles.sectionTitle} className="sectionTitle">
                    Recent Transactions
                  </h2>
                  <div style={styles.sectionActions}>
                    <button
                      onClick={() => handleViewChange('reports')}
                      style={styles.viewAllButton}
                      className="viewAllButton"
                    >
                      View Reports →
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
              </div>
            </>
          )}
        </div>
      </main>

      {isMobile && (
        <button
          onClick={() => {
            setEditingTransaction(null);
            setShowTransactionForm(true);
          }}
          style={styles.fab}
          className="fab"
        >
          +
        </button>
      )}

      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <p style={styles.footerText}>
            MoneyTracker - Financial Management
          </p>
          <p style={styles.footerSubtext}>
            Track & Analyze Your Finances
          </p>
          {!isMobile && (
            <>
              <div style={styles.footerLinks}>
                <span style={styles.footerLink}>Privacy</span>
                <span style={styles.footerDivider}>•</span>
                <span style={styles.footerLink}>Terms</span>
                <span style={styles.footerDivider}>•</span>
                <span style={styles.footerLink}>Support</span>
              </div>
              <p style={styles.footerCopyright}>
                Developed by Raya Sesan - 51423249 • ©{' '}
                {new Date().getFullYear()}
              </p>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

const styles = {
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#f8fafc',
  },
  loader: {
    textAlign: 'center',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #f1f5f9',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
    margin: '0 auto 15px',
  },
  loadingText: {
    color: '#64748b',
    fontSize: '16px',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  changingViewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  changingViewSpinner: {
    width: '30px',
    height: '30px',
    border: '2px solid #f1f5f9',
    borderTop: '2px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.4s linear infinite',
  },
  container: {
    minHeight: '100vh',
    width: '100%',
    backgroundColor: '#f8fafc',
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflowX: 'hidden',
    position: 'relative',
  },
  header: {
    backgroundColor: 'white',
    padding: '15px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    width: '100%',
    borderBottom: '1px solid #e2e8f0',
    flexWrap: 'wrap',
    gap: '15px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    flex: 1,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    justifyContent: 'flex-end',
    flex: 1,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: '-0.3px',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  greeting: {
    display: 'flex',
    flexDirection: 'column',
  },
  greetingText: {
    fontSize: '14px',
    color: '#64748b',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  userName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  userStats: {
    display: 'flex',
    gap: '20px',
    backgroundColor: '#f8fafc',
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '70px',
  },
  statNumber: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#3b82f6',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  statLabel: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '2px',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  addTransactionBtn: {
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.3s ease',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  plusIcon: {
    fontSize: '18px',
    fontWeight: 'bold',
  },
  logoutBtn: {
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.3s ease',
    whiteSpace: 'nowrap',
    minWidth: '90px',
    boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  nav: {
    backgroundColor: 'white',
    padding: '10px 20px',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: '79px',
    zIndex: 99,
    width: '100%',
  },
  navWrapper: {
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  navContainer: {
    width: '100%',
  },
  navButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    width: '100%',
  },
  navButton: {
    backgroundColor: '#f8fafc',
    color: '#64748b',
    border: 'none',
    padding: '14px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '15px',
    transition: 'all 0.3s ease',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    border: '1px solid transparent',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  navButtonActive: {
    backgroundColor: 'white',
    color: '#3b82f6',
    fontWeight: '600',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0',
  },
  navIconContainer: {
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    width: '18px',
    height: '18px',
  },
  navText: {
    fontSize: '15px',
    fontWeight: '500',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  main: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    paddingBottom: '20px',
    position: 'relative',
  },
  contentArea: {
    minHeight: 'calc(100vh - 200px)',
    width: '100%',
    overflow: 'visible',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    width: '100%',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: '#1e293b',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '24px',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'all 0.2s ease',
  },
  statsGrid: {
    display: 'grid',
    gap: '20px',
    marginBottom: '25px',
    width: '100%',
  },
  summaryCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'transform 0.3s ease',
  },
  cardHeader: {
    margin: '0 0 15px 0',
  },
  cardTitleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cardIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconSvg: {
    width: '18px',
    height: '18px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  cardAmount: {
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 10px 0',
    color: '#1e293b',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  cardTrend: {
    marginTop: '4px',
  },
  trendIndicator: {
    fontSize: '13px',
    fontWeight: '500',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  cardProgress: {
    marginTop: '12px',
  },
  progressBar: {
    height: '5px',
    backgroundColor: '#e2e8f0',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
  },
  quickStats: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    marginBottom: '25px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    width: '100%',
    boxSizing: 'border-box',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '18px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  statsGridSmall: {
    display: 'grid',
    gap: '16px',
  },
  statCard: {
    backgroundColor: '#f8fafc',
    padding: '16px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    border: '1px solid #e2e8f0',
    transition: 'transform 0.3s ease',
  },
  statIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statIconSvg: {
    width: '22px',
    height: '22px',
  },
  statContent: {
    flex: 1,
  },
  statNumberSmall: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  statLabelSmall: {
    fontSize: '13px',
    color: '#64748b',
    margin: '3px 0 0 0',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  transactionSection: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    width: '100%',
    boxSizing: 'border-box',
  },
  sectionActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  viewAllButton: {
    backgroundColor: 'transparent',
    color: '#3b82f6',
    border: '1px solid #3b82f6',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
    transition: 'all 0.3s ease',
    whiteSpace: 'nowrap',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  fab: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    transition: 'all 0.3s ease',
  },
  footer: {
    backgroundColor: '#1e293b',
    color: 'white',
    padding: '20px',
    marginTop: '30px',
    width: '100%',
  },
  footerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '14px',
    fontWeight: '600',
    margin: '0 0 6px 0',
    color: '#f1f5f9',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  footerSubtext: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: '0 0 16px 0',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  footerLinks: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
  },
  footerLink: {
    color: '#cbd5e1',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'color 0.3s ease',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  footerDivider: {
    color: '#64748b',
    fontSize: '11px',
  },
  footerCopyright: {
    fontSize: '11px',
    color: '#64748b',
    margin: '16px 0 0 0',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
};

// Global CSS via <style> tag (aman, dicek dulu biar gak dobel)
if (typeof document !== 'undefined') {
  if (!document.getElementById('app-global-styles')) {
    const style = document.createElement('style');
    style.id = 'app-global-styles';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .summaryCard:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0,0,0,0.1);
      }

      .statCard:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }

      .logoutBtn:hover {
        background-color: #dc2626;
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
      }

      .addTransactionBtn:hover {
        background-color: #059669;
        transform: translateY(-1px);
      }

      .navButton:hover:not(.navButtonActive) {
        background-color: #e2e8f0;
      }

      .navButtonActive:hover {
        background-color: white;
      }

      .viewAllButton:hover {
        background-color: #3b82f6;
        color: white;
      }

      .fab:hover {
        background-color: #2563eb;
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
      }

      body, button, input, select, textarea {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      * {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      html {
        scroll-behavior: smooth;
      }

      /* DESKTOP */
      @media (min-width: 769px) {
        .header {
          padding: 20px 40px;
        }

        .nav {
          padding: 12px 40px;
        }

        .navWrapper {
          max-width: 1200px;
        }

        .navButtons {
          gap: 15px;
        }

        .navButton {
          padding: 16px 24px;
          font-size: 16px;
        }

        .main {
          padding: 30px 40px;
        }

        .statsGrid {
          gap: 25px;
        }

        .summaryCard {
          padding: 24px;
        }

        .cardAmount {
          font-size: 28px;
        }

        .fab {
          display: none;
        }

        .userStats {
          padding: 12px 24px;
        }

        .navText {
          font-size: 16px;
        }

        .title {
          font-size: 22px;
        }
      }

      /* MOBILE & TABLET */
      @media (max-width: 768px) {
        .categories-manager-wrapper {
          width: 100% !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
          box-sizing: border-box !important;
        }

        .nav {
          padding: 10px 16px !important;
          top: 79px !important;
          position: sticky !important;
          z-index: 99 !important;
          width: 100% !important;
          overflow-x: hidden !important;
          box-sizing: border-box !important;
        }

        .navWrapper,
        .navContainer {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
        }

        .navButtons {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 8px !important;
          width: 100% !important;
          min-width: 100% !important;
          overflow-x: hidden !important;
          box-sizing: border-box !important;
        }

        .navButton {
          padding: 12px 10px !important;
          font-size: 14px !important;
          min-width: 0 !important;
          width: 100% !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .navText {
          font-size: 13px !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          display: block !important;
        }

        .navIconContainer {
          width: 20px !important;
          height: 20px !important;
          flex-shrink: 0 !important;
        }

        .navIcon {
          width: 16px !important;
          height: 16px !important;
        }

        .header {
          padding: 12px 16px !important;
          gap: 12px !important;
          width: 100% !important;
          box-sizing: border-box !important;
          overflow-x: hidden !important;
        }

        .title {
          font-size: 18px !important;
        }

        .logoutBtn {
          padding: 8px 16px !important;
          font-size: 13px !important;
          min-width: 70px !important;
        }

        .main {
          padding: 16px !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          overflow-x: hidden !important;
        }

        .contentArea {
          width: 100% !important;
          overflow-x: hidden !important;
        }

        .summaryCard {
          padding: 16px !important;
        }

        .cardAmount {
          font-size: 22px !important;
        }

        .cardTitle {
          font-size: 15px !important;
        }

        .statCard {
          padding: 14px !important;
        }

        .statIcon {
          width: 40px !important;
          height: 40px !important;
        }

        .statIconSvg {
          width: 20px !important;
          height: 20px !important;
        }

        .statNumberSmall {
          font-size: 18px !important;
        }

        .sectionHeader {
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 10px !important;
        }

        .sectionTitle {
          font-size: 17px !important;
        }

        .fab {
          width: 50px !important;
          height: 50px !important;
          font-size: 24px !important;
          bottom: 25px !important;
          right: 25px !important;
        }
      }

      /* EXTRA SMALL */
      @media (max-width: 480px) {
        .navButtons {
          gap: 6px !important;
        }

        .navButton {
          padding: 12px 8px !important;
          font-size: 12px !important;
        }

        .navText {
          font-size: 12px !important;
        }

        .navIcon {
          width: 14px !important;
          height: 14px !important;
        }

        .greeting {
          display: none !important;
        }

        .title {
          font-size: 17px !important;
        }

        .main {
          padding: 12px !important;
        }

        .cardAmount {
          font-size: 20px !important;
        }

        .statNumberSmall {
          font-size: 16px !important;
        }

        .sectionTitle {
          font-size: 16px !important;
        }

        .statsGridSmall {
          gap: 12px !important;
        }

        .statCard {
          padding: 12px !important;
          gap: 10px !important;
        }

        .statIcon {
          width: 36px !important;
          height: 36px !important;
        }

        .viewAllButton {
          padding: 6px 12px !important;
          font-size: 12px !important;
        }

        .fab {
          width: 50px !important;
          height: 50px !important;
          font-size: 24px !important;
          bottom: 25px !important;
          right: 25px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

export default App;
