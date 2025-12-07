import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function TransactionForm({ transaction, onSave, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense',
    category_id: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (transaction) {
      setFormData({
        amount: transaction.amount,
        type: transaction.type,
        category_id: transaction.category_id,
        description: transaction.description,
        date: transaction.date
      });
    }
    fetchCategories();
  }, [transaction]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      alert('Failed to load categories');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const transactionData = {
        user_id: user.id,
        amount: parseFloat(formData.amount),
        type: formData.type,
        category_id: formData.category_id || null,
        description: formData.description,
        date: formData.date
      };

      let error;
      if (transaction?.id) {
        const result = await supabase
          .from('transactions')
          .update(transactionData)
          .eq('id', transaction.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('transactions')
          .insert([transactionData]);
        error = result.error;
      }

      if (error) throw error;
      alert(transaction ? 'Transaction updated!' : 'Transaction added!');
      onSave();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const currentCategories = formData.type === 'income' ? incomeCategories : expenseCategories;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>{transaction ? 'Edit Transaction' : 'Add New Transaction'}</h3>
      
      <form onSubmit={handleSubmit}>
        {/* Transaction Type */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Transaction Type *</label>
          <div style={styles.radioGroup}>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="type"
                value="income"
                checked={formData.type === 'income'}
                onChange={handleChange}
                style={styles.radioInput}
              />
              <span style={{...styles.radioText, color: '#10B981'}}>
                Income
              </span>
            </label>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="type"
                value="expense"
                checked={formData.type === 'expense'}
                onChange={handleChange}
                style={styles.radioInput}
              />
              <span style={{...styles.radioText, color: '#EF4444'}}>
                Expense
              </span>
            </label>
          </div>
        </div>

        {/* Amount */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Amount (IDR) *</label>
          <div style={styles.amountContainer}>
            <span style={styles.currency}>Rp</span>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              required
              min="0"
              step="1"
              style={styles.amountInput}
              placeholder="0"
            />
          </div>
        </div>

        {/* Category */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Category</label>
          <select
            name="category_id"
            value={formData.category_id}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="">-- Select Category --</option>
            {currentCategories.map(cat => (
              <option key={cat.id} value={cat.id} style={{ color: cat.color }}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Description</label>
          <input
            type="text"
            name="description"
            value={formData.description}
            onChange={handleChange}
            style={styles.input}
            placeholder="What is this transaction for?"
            maxLength="100"
          />
        </div>

        {/* Date */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Date *</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            style={styles.input}
            required
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Buttons */}
        <div style={styles.buttonGroup}>
          <button
            type="button"
            onClick={onCancel}
            style={styles.cancelButton}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={styles.submitButton}
            disabled={loading}
          >
            {loading ? (
              <span>Saving...</span>
            ) : transaction ? (
              'Update Transaction'
            ) : (
              'Add Transaction'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    maxWidth: '500px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif'
  },
  title: {
    margin: '0 0 25px 0',
    color: '#1e293b',
    fontSize: '24px',
    textAlign: 'center'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '600',
    color: '#475569',
    fontSize: '14px'
  },
  radioGroup: {
    display: 'flex',
    gap: '20px',
    marginTop: '5px'
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    flex: 1,
    justifyContent: 'center'
  },
  radioInput: {
    marginRight: '8px'
  },
  radioText: {
    fontWeight: '500',
    fontSize: '15px'
  },
  amountContainer: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  currency: {
    backgroundColor: '#f8fafc',
    padding: '12px 15px',
    borderRight: '1px solid #e2e8f0',
    fontWeight: '500',
    color: '#475569'
  },
  amountInput: {
    flex: 1,
    padding: '12px',
    border: 'none',
    fontSize: '16px',
    outline: 'none'
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.3s'
  },
  select: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '16px',
    backgroundColor: 'white',
    outline: 'none',
    cursor: 'pointer'
  },
  buttonGroup: {
    display: 'flex',
    gap: '15px',
    marginTop: '30px'
  },
  cancelButton: {
    flex: 1,
    padding: '14px',
    backgroundColor: 'transparent',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  submitButton: {
    flex: 2,
    padding: '14px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  }
};

export default TransactionForm;