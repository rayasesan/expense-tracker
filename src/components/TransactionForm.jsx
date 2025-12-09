import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function TransactionForm({ transaction, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'expense',
    category_id: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (transaction) {
      setFormData({
        description: transaction.description || '',
        amount: transaction.amount || '',
        type: transaction.type || 'expense',
        category_id: transaction.category_id || '',
        date: transaction.date ? new Date(transaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
    }
    fetchCategories();
  }, [transaction]);

  const fetchCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      setCategories(data || []);
      
      // Jika tidak ada transaction (add new) dan ada categories,
      // set default category otomatis
      if (!transaction && data && data.length > 0) {
        const defaultExpense = data.find(c => c.type === 'expense');
        const defaultIncome = data.find(c => c.type === 'income');
        
        if (formData.type === 'expense' && defaultExpense) {
          setFormData(prev => ({ ...prev, category_id: defaultExpense.id }));
        } else if (formData.type === 'income' && defaultIncome) {
          setFormData(prev => ({ ...prev, category_id: defaultIncome.id }));
        } else if (data[0]) {
          // Fallback ke category pertama
          setFormData(prev => ({ 
            ...prev, 
            category_id: data[0].id,
            type: data[0].type 
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    
    // Jika type berubah, reset category_id dan pilih yang sesuai
    if (name === 'type') {
      const filtered = categories.filter(cat => cat.type === value);
      if (filtered.length > 0) {
        setFormData(prev => ({ 
          ...prev, 
          type: value,
          category_id: filtered[0].id 
        }));
      } else {
        setFormData(prev => ({ 
          ...prev, 
          type: value,
          category_id: '' 
        }));
      }
    }
  };

  const validateForm = () => {
    if (!formData.description.trim()) {
      setError('Description is required');
      return false;
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Amount must be greater than 0');
      return false;
    }
    
    if (!formData.category_id) {
      setError('Please select a category');
      return false;
    }
    
    // Validasi UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(formData.category_id)) {
      setError('Invalid category selected');
      return false;
    }
    
    // Validasi category ada di list categories
    const selectedCategory = categories.find(c => c.id === formData.category_id);
    if (!selectedCategory) {
      setError('Selected category not found');
      return false;
    }
    
    // Validasi type category sesuai
    if (selectedCategory.type !== formData.type) {
      setError(`Category "${selectedCategory.name}" is for ${selectedCategory.type}, not ${formData.type}`);
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validasi
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const transactionData = {
        user_id: user.id,
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        type: formData.type,
        category_id: formData.category_id, // TIDAK BOLEH NULL
        date: formData.date
      };

      if (transaction) {
        // Update
        const { error } = await supabase
          .from('transactions')
          .update(transactionData)
          .eq('id', transaction.id);
        
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('transactions')
          .insert([transactionData]);
        
        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving transaction:', error);
      setError('Error saving transaction: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(cat => cat.type === formData.type);

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {error && (
        <div style={styles.errorAlert}>
          <span style={styles.errorText}>{error}</span>
        </div>
      )}

      <div style={styles.formGroup}>
        <label style={styles.label}>Description *</label>
        <input
          type="text"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          placeholder="Enter transaction description"
          style={styles.input}
          required
          maxLength={100}
        />
        <div style={styles.charCount}>
          {formData.description.length}/100
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Amount (IDR) *</label>
        <input
          type="number"
          name="amount"
          value={formData.amount}
          onChange={handleInputChange}
          placeholder="0"
          style={styles.input}
          required
          min="100"
          step="100"
        />
        <div style={styles.amountHint}>
          Minimum: Rp 100
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Type *</label>
        <div style={styles.radioGroup}>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="type"
              value="expense"
              checked={formData.type === 'expense'}
              onChange={handleInputChange}
              style={styles.radioInput}
            />
            <span style={{ color: '#EF4444', marginLeft: '6px', fontWeight: '600' }}>
              {isMobile ? 'Expense' : 'Expense'}
            </span>
          </label>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="type"
              value="income"
              checked={formData.type === 'income'}
              onChange={handleInputChange}
              style={styles.radioInput}
            />
            <span style={{ color: '#10B981', marginLeft: '6px', fontWeight: '600' }}>
              {isMobile ? 'Income' : 'Income'}
            </span>
          </label>
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Category *</label>
        {filteredCategories.length === 0 ? (
          <div style={styles.noCategoriesWarning}>
            <p style={styles.warningText}>
              No {formData.type} categories available.
            </p>
            <p style={styles.warningSubtext}>
              Please add {formData.type} categories in the Categories page first.
            </p>
          </div>
        ) : (
          <>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleInputChange}
              style={{
                ...styles.select,
                borderColor: !formData.category_id ? '#EF4444' : '#e2e8f0'
              }}
              required
            >
              <option value="">-- Select a category --</option>
              {filteredCategories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {formData.category_id && (
              <div style={styles.selectedCategoryInfo}>
                <div style={{
                  ...styles.categoryColor,
                  backgroundColor: filteredCategories.find(c => c.id === formData.category_id)?.color || '#ccc'
                }} />
                <span style={styles.categoryName}>
                  {filteredCategories.find(c => c.id === formData.category_id)?.name}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Date *</label>
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleInputChange}
          style={styles.input}
          required
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div style={styles.formActions}>
        <button
          type="button"
          onClick={onCancel}
          style={styles.cancelButton}
          disabled={loading}
          className="cancelButton"
        >
          Cancel
        </button>
        <button
          type="submit"
          style={styles.submitButton}
          disabled={loading || filteredCategories.length === 0}
          className="submitButton"
        >
          {loading ? (
            <span style={styles.loadingText}>
              <span style={styles.spinner}></span>
              {isMobile ? 'Saving...' : 'Saving...'}
            </span>
          ) : transaction ? 'Update' : 'Save'}
        </button>
      </div>
      
      <div style={styles.requiredNote}>
        * Required fields
      </div>
    </form>
  );
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    width: '100%',
  },
  errorAlert: {
    backgroundColor: '#FEE2E2',
    border: '1px solid #FCA5A5',
    color: '#DC2626',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
  },
  errorText: {
    fontSize: '14px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
  },
  input: {
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '16px',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#f8fafc',
  },
  charCount: {
    fontSize: '12px',
    color: '#64748b',
    textAlign: 'right',
  },
  amountHint: {
    fontSize: '12px',
    color: '#64748b',
    fontStyle: 'italic',
  },
  radioGroup: {
    display: 'flex',
    gap: '20px',
    marginTop: '4px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  radioInput: {
    margin: 0,
  },
  select: {
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '16px',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#f8fafc',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '16px',
  },
  noCategoriesWarning: {
    backgroundColor: '#FEF3C7',
    border: '1px solid #FBBF24',
    borderRadius: '8px',
    padding: '12px',
    textAlign: 'center',
  },
  warningText: {
    color: '#92400E',
    fontSize: '14px',
    fontWeight: '600',
    margin: 0,
    marginBottom: '4px',
  },
  warningSubtext: {
    color: '#92400E',
    fontSize: '12px',
    margin: 0,
    opacity: 0.8,
  },
  selectedCategoryInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#f1f5f9',
    borderRadius: '6px',
  },
  categoryColor: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
  },
  categoryName: {
    fontSize: '13px',
    color: '#475569',
    fontWeight: '500',
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '10px',
  },
  cancelButton: {
    flex: 1,
    padding: '14px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  submitButton: {
    flex: 1,
    padding: '14px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
  },
  loadingText: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  requiredNote: {
    fontSize: '12px',
    color: '#64748b',
    textAlign: 'center',
    marginTop: '10px',
    fontStyle: 'italic',
  },
};

// Add CSS animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .cancelButton:hover:not(:disabled) {
      background-color: #e2e8f0;
    }
    
    .submitButton:hover:not(:disabled) {
      background-color: #2563eb;
    }
    
    .submitButton:disabled {
      background-color: #94a3b8;
      cursor: not-allowed;
    }
    
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    input:focus, select:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
    
    select:invalid {
      border-color: #EF4444;
    }
    
    @media (max-width: 480px) {
      .radioGroup {
        flex-direction: column;
        gap: 8px;
      }
      
      .formActions {
        flex-direction: column;
      }
      
      .cancelButton, .submitButton {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
}

export default TransactionForm;