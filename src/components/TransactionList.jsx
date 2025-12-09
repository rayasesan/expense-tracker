import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

function TransactionList({ refreshTrigger, onEdit }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  // Check mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  
  // Fetch all transactions tanpa limit
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          date,
          type,
          amount,
          description,
          categories (
            name,
            color
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load transactions
  useEffect(() => {
    let timer;
    const loadData = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fetchTransactions();
      }, 100);
    };
    
    loadData();
    return () => clearTimeout(timer);
  }, [refreshTrigger, fetchTransactions]);

  // Check if transaction still exists in database
  const checkRemainingTransactions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      console.log('Total transactions in DB:', data?.length || 0);
      console.log('Transactions in UI:', transactions.length);
      
      // Jika ada mismatch, refresh
      if (data?.length !== transactions.length) {
        console.log('Mismatch detected, refreshing...');
        fetchTransactions();
      }
    } catch (error) {
      console.error('Error checking remaining transactions:', error);
    }
  }, [transactions.length, fetchTransactions]);

  // Fast delete with better cleanup
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;

    setIsDeleting(id);
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Instant UI update
      setTransactions(prev => prev.filter(t => t.id !== id));
      
      // Check remaining transactions
      setTimeout(() => {
        checkRemainingTransactions();
      }, 500);
      
      // Show quick toast
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
        color: white;
        padding: 10px 16px;
        border-radius: 6px;
        z-index: 1000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      `;
      toast.textContent = 'Transaction deleted';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
      
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Delete failed. Try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  // Delete all transactions button
  const handleDeleteAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL transactions? This cannot be undone!')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      // Clear UI
      setTransactions([]);
      
      // Show success message
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
        color: white;
        padding: 10px 16px;
        border-radius: 6px;
        z-index: 1000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      `;
      toast.textContent = 'All transactions deleted';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
      
    } catch (error) {
      console.error('Error deleting all transactions:', error);
      alert('Delete all failed. Try again.');
    }
  };

  // Format functions
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

  // Fast loading skeleton
  if (loading && transactions.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.skeletonGrid}>
          {[1, 2, 3].map(i => (
            <div key={i} style={styles.skeletonCard}>
              <div style={styles.skeletonType}></div>
              <div style={styles.skeletonContent}>
                <div style={styles.skeletonTitle}></div>
                <div style={styles.skeletonMeta}></div>
              </div>
              <div style={styles.skeletonAmount}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!loading && transactions.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>📋</div>
        <h3 style={styles.emptyTitle}>No Transactions</h3>
        <p style={styles.emptyText}>Add your first transaction</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Delete All Button - only show if there are transactions */}
      {transactions.length > 0 && (
        <div style={styles.deleteAllContainer}>
          <button
            onClick={handleDeleteAll}
            style={styles.deleteAllButton}
            title="Delete all transactions"
          >
             Delete All ({transactions.length})
          </button>
         
        </div>
      )}

      <div style={styles.transactionGrid}>
        {transactions.map((transaction) => (
          <div key={transaction.id} style={styles.transactionCard}>
            {/* Top Row: Type, Description, Amount */}
            <div style={styles.topRow}>
              <div style={styles.typeAndInfo}>
                <span style={{
                  ...styles.typeBadge,
                  backgroundColor: transaction.type === 'income' ? '#10B981' : '#EF4444',
                  fontSize: isMobile ? '10px' : '11px'
                }}>
                  {transaction.type === 'income' ? 'Income' : 'Expense'}
                </span>
                
                <div style={styles.descriptionSection}>
                  <h3 style={{
                    ...styles.transactionTitle,
                    fontSize: isMobile ? '14px' : '15px'
                  }}>
                    {transaction.description || 'No Description'}
                  </h3>
                  {/* Mobile Amount */}
                  {isMobile && (
                    <div style={styles.mobileAmount}>
                      <span style={{
                        color: transaction.type === 'income' ? '#10B981' : '#EF4444',
                        fontWeight: '700',
                        fontSize: '14px'
                      }}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Desktop Amount */}
              {!isMobile && (
                <div style={styles.desktopAmount}>
                  <span style={{
                    color: transaction.type === 'income' ? '#10B981' : '#EF4444',
                    fontWeight: '700',
                    fontSize: '15px'
                  }}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </span>
                </div>
              )}
            </div>
            
            {/* Bottom Row: Date, Category, Actions */}
            <div style={styles.bottomRow}>
              <div style={styles.metaInfo}>
                <span style={styles.date}>{formatDate(transaction.date)}</span>
                <span style={styles.divider}>•</span>
                <span style={styles.category}>
                  {transaction.categories?.name || 'Uncategorized'}
                </span>
              </div>
              
              <div style={styles.actionButtons}>
                <button
                  onClick={() => onEdit(transaction)}
                  style={styles.editButton}
                  disabled={isDeleting === transaction.id}
                  title="Edit"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(transaction.id)}
                  style={styles.deleteButton}
                  disabled={isDeleting === transaction.id}
                  title="Delete"
                >
                  {isDeleting === transaction.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Debug info - hanya untuk development */}
      {process.env.NODE_ENV === 'development' && (
        <div style={styles.debugInfo}>
          <small>
            Showing {transactions.length} transactions | 
            Last refresh: {new Date().toLocaleTimeString()}
          </small>
          <button 
            onClick={checkRemainingTransactions}
            style={styles.debugButton}
          >
            Refresh Check
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
  },
  // Delete All Container
  deleteAllContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    padding: '10px 15px',
    backgroundColor: '#f4f4f9ff',
    border: '1px solid #c2c2c2ff',
    borderRadius: '6px',
  },
  deleteAllButton: {
    backgroundColor: '#464646ff',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
  },
  totalAmount: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#334155',
  },
  // Debug Info
  debugInfo: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#f1f5f9',
    border: '1px dashed #94a3b8',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#64748b',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debugButton: {
    backgroundColor: '#e2e8f0',
    color: '#475569',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '3px',
    fontSize: '10px',
    cursor: 'pointer',
  },
  // ... (sisanya sama seperti sebelumnya, tetap include semua styles)
  skeletonGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  skeletonCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  skeletonType: {
    width: '60px',
    height: '24px',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonTitle: {
    height: '16px',
    width: '70%',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
    marginBottom: '6px',
  },
  skeletonMeta: {
    height: '12px',
    width: '50%',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
  },
  skeletonAmount: {
    width: '80px',
    height: '20px',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
  },
  // Empty State
  emptyState: {
    textAlign: 'center',
    padding: '30px 20px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '2px dashed #e2e8f0',
  },
  emptyIcon: {
    fontSize: '32px',
    marginBottom: '10px',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#334155',
    marginBottom: '6px',
  },
  emptyText: {
    fontSize: '13px',
    color: '#64748b',
  },
  // Transaction Card
  transactionGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  transactionCard: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '16px',
    transition: 'all 0.2s ease',
  },
  // Top Row
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
    width: '100%',
  },
  typeAndInfo: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    flex: 1,
  },
  typeBadge: {
    padding: '4px 10px',
    borderRadius: '4px',
    fontWeight: '600',
    color: 'white',
    whiteSpace: 'nowrap',
    minWidth: '70px',
    textAlign: 'center',
    flexShrink: 0,
  },
  descriptionSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  transactionTitle: {
    margin: 0,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: '1.4',
  },
  mobileAmount: {
    marginTop: '2px',
  },
  desktopAmount: {
    marginLeft: '10px',
    flexShrink: 0,
  },
  // Bottom Row
  bottomRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    flexWrap: 'wrap',
    gap: '8px',
  },
  metaInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#64748b',
    flex: 1,
  },
  date: {
    fontSize: '12px',
  },
  divider: {
    fontSize: '8px',
  },
  category: {
    backgroundColor: '#f1f5f9',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  editButton: {
    backgroundColor: '#f0f9ff',
    color: '#0369a1',
    border: '1px solid #bae6fd',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    minWidth: '60px',
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    minWidth: '60px',
    textAlign: 'center',
  },
};

// Add CSS animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .transactionCard {
      animation: fadeIn 0.3s ease;
    }
    
    .transactionCard:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      border-color: #cbd5e1;
    }
    
    .editButton:hover:not(:disabled) {
      background-color: #e0f2fe;
      transform: translateY(-1px);
    }
    
    .deleteButton:hover:not(:disabled) {
      background-color: #fee2e2;
      transform: translateY(-1px);
    }
    
    .editButton:disabled,
    .deleteButton:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .deleteAllButton:hover {
      background-color: #dc2626 !important;
      transform: translateY(-1px);
    }
    
    /* Mobile Styles */
    @media (max-width: 768px) {
      .deleteAllContainer {
        flex-direction: column;
        gap: 10px;
        align-items: stretch;
      }
      
      .deleteAllButton {
        justify-content: center;
      }
      
      .totalAmount {
        text-align: center;
      }
      
      .transactionCard {
        padding: 14px;
      }
      
      .topRow {
        flex-direction: column;
        gap: 8px;
        margin-bottom: 10px;
      }
      
      .typeAndInfo {
        width: 100%;
      }
      
      .mobileAmount {
        display: block;
      }
      
      .desktopAmount {
        display: none;
      }
      
      .bottomRow {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }
      
      .metaInfo {
        width: 100%;
        order: 2;
      }
      
      .actionButtons {
        width: 100%;
        order: 1;
        justify-content: flex-end;
      }
      
      .editButton,
      .deleteButton {
        flex: 1;
        padding: 8px 12px;
        font-size: 13px;
        min-width: 0;
      }
      
      .transactionTitle {
        font-size: 13px;
        line-height: 1.3;
      }
      
      .typeBadge {
        font-size: 10px;
        padding: 4px 8px;
        min-width: 60px;
      }
      
      .metaInfo {
        font-size: 11px;
      }
    }
    
    /* Small Mobile */
    @media (max-width: 480px) {
      .transactionCard {
        padding: 12px;
      }
      
      .editButton,
      .deleteButton {
        padding: 7px 10px;
        font-size: 12px;
      }
      
      .transactionTitle {
        font-size: 12px;
      }
      
      .typeBadge {
        font-size: 9px;
        padding: 3px 6px;
        min-width: 55px;
      }
    }
    
    /* Desktop Styles */
    @media (min-width: 769px) {
      .mobileAmount {
        display: none !important;
      }
      
      .desktopAmount {
        display: block;
      }
      
      .actionButtons {
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      .transactionCard:hover .actionButtons {
        opacity: 1;
      }
      
      .editButton,
      .deleteButton {
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  `;
  document.head.appendChild(style);
}

export default React.memo(TransactionList);