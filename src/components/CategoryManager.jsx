import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense',
    color: '#3B82F6'
  });
  const [isMobile, setIsMobile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchCategories();
    
    // Setup real-time subscription
    let channel;
    
    const setupRealtime = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        channel = supabase
          .channel('categories-changes')
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'categories',
              filter: `user_id=eq.${user.id}`
            }, 
            () => {
              fetchCategories();
            }
          )
          .subscribe();
      } catch (error) {
        console.error('Error setting up realtime:', error);
      }
    };

    setupRealtime();
    
    // Cleanup function
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('type')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
      
      // Dispatch event untuk notify components lain
      window.dispatchEvent(new CustomEvent('categoriesUpdated', { 
        detail: { categories: data || [] } 
      }));
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Failed to load categories: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('You must be logged in to manage categories');
      }

      const categoryData = {
        user_id: user.id,
        name: formData.name.trim(),
        type: formData.type,
        color: formData.color
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', editingCategory.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([categoryData]);
        
        if (error) throw error;
      }

      setShowForm(false);
      setEditingCategory(null);
      setFormData({ name: '', type: 'expense', color: '#3B82F6' });
      
      // Fetch categories and notify
      await fetchCategories();
      
      // Show success message
      showToast(
        editingCategory ? 'Category updated!' : 'Category created!',
        'success'
      );
      
    } catch (error) {
      console.error('Error saving category:', error);
      setError('Error: ' + error.message);
      showToast('Failed to save category', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      color: category.color
    });
    setShowForm(true);
    
    // Scroll to form
    setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDelete = async (category) => {
    try {
      // Check if category is used in transactions
      const { data: transactions, error: checkError } = await supabase
        .from('transactions')
        .select('id')
        .eq('category_id', category.id)
        .limit(1);

      if (checkError) throw checkError;

      if (transactions && transactions.length > 0) {
        setError(`Cannot delete "${category.name}" - used in ${transactions.length} transaction(s)`);
        showToast(`Cannot delete "${category.name}" - used in transactions`, 'error');
        return;
      }

      if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id);
      
      if (error) throw error;
      
      // Update local state and notify
      setCategories(prev => prev.filter(c => c.id !== category.id));
      
      // Dispatch event untuk notify components lain
      window.dispatchEvent(new CustomEvent('categoriesUpdated', { 
        detail: { 
          action: 'delete',
          categoryId: category.id
        } 
      }));
      
      showToast('Category deleted!', 'success');
      
    } catch (error) {
      console.error('Delete failed:', error);
      setError('Delete failed: ' + error.message);
      showToast('Delete failed', 'error');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCategory(null);
    setFormData({ name: '', type: 'expense', color: '#3B82F6' });
    setError(null);
  };

  const showToast = (message, type = 'info') => {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.category-toast');
    existingToasts.forEach(toast => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    });
    
    const toast = document.createElement('div');
    toast.className = 'category-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
      color: white;
      padding: 12px 18px;
      border-radius: 8px;
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: toastSlideIn 0.3s ease;
      max-width: 300px;
    `;
    
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  const colorOptions = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
    '#EC4899', '#6B7280', '#84CC16', '#F97316', '#6366F1',
    '#F43F5E', '#D946EF', '#0EA5E9', '#14B8A6', '#22C55E',
    '#A855F7', '#06B6D4', '#FBBF24', '#DC2626', '#7C3AED'
  ];

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <div style={styles.container} ref={containerRef}>
      <div style={styles.header}>
        <h2 style={styles.title}>Manage Categories</h2>
        <button
          onClick={() => setShowForm(true)}
          style={styles.addButton}
          className="addButton"
        >
          {isMobile ? 'Add' : 'Add Category'}
        </button>
      </div>

      {error && !showForm && (
        <div style={styles.errorAlert}>
          <span style={styles.errorText}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={styles.errorClose}
          >
            ×
          </button>
        </div>
      )}

      {showForm && (
        <div style={styles.formCard}>
          <div style={styles.formHeader}>
            <h3 style={styles.formTitle}>{editingCategory ? 'Edit' : 'Add'} Category</h3>
            <button
              onClick={handleCancel}
              style={styles.closeButton}
            >
              ×
            </button>
          </div>
          
          {error && (
            <div style={styles.formError}>
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Food, Transportation, etc."
                style={styles.input}
                required
                autoFocus
                maxLength={50}
              />
              <div style={styles.charCount}>
                {formData.name.length}/50
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Type *</label>
              <div style={styles.radioGroup}>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="type"
                    value="income"
                    checked={formData.type === 'income'}
                    onChange={handleInputChange}
                    style={styles.radioInput}
                  />
                  <span style={{ color: '#10B981', marginLeft: '6px', fontWeight: '600' }}>Income</span>
                </label>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="type"
                    value="expense"
                    checked={formData.type === 'expense'}
                    onChange={handleInputChange}
                    style={styles.radioInput}
                  />
                  <span style={{ color: '#EF4444', marginLeft: '6px', fontWeight: '600' }}>Expense</span>
                </label>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Color</label>
              <div style={styles.colorGrid}>
                {colorOptions.map((color, index) => (
                  <button
                    key={`${color}-${index}`}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, color }));
                      setError(null);
                    }}
                    style={{
                      ...styles.colorOption,
                      backgroundColor: color,
                      border: formData.color === color ? '3px solid #1e293b' : '1px solid #e2e8f0',
                      transform: formData.color === color ? 'scale(1.1)' : 'scale(1)',
                      boxShadow: formData.color === color ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
                    }}
                    title={color}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
              <div style={styles.selectedColorPreview}>
                <div 
                  style={{ 
                    backgroundColor: formData.color,
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    marginRight: '10px',
                    border: '2px solid #e2e8f0'
                  }}
                />
                <span style={styles.colorHex}>{formData.color}</span>
              </div>
            </div>

            <div style={styles.formActions}>
              <button
                type="button"
                onClick={handleCancel}
                style={styles.cancelButton}
                className="cancelButton"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={styles.submitButton}
                className="submitButton"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span style={styles.buttonLoading}>
                    <span style={styles.buttonSpinner}></span>
                    {isMobile ? '...' : 'Processing...'}
                  </span>
                ) : editingCategory ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <span style={styles.loadingText}>Loading categories...</span>
        </div>
      ) : (
        <div style={styles.categoriesGrid}>
          <div style={styles.categorySection}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>
                <span style={{ 
                  backgroundColor: '#10B981', 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%',
                  marginRight: '8px',
                  display: 'inline-block'
                }}></span>
                <h3 style={{ color: '#10B981', fontSize: '18px', margin: 0, display: 'inline' }}>
                  Income ({incomeCategories.length})
                </h3>
              </div>
              <button
                onClick={() => {
                  setFormData({ name: '', type: 'income', color: '#10B981' });
                  setShowForm(true);
                }}
                style={styles.sectionAddButton}
              >
                + Add
              </button>
            </div>
            {incomeCategories.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>📥</div>
                <p style={styles.emptyMessage}>No income categories yet</p>
                <button
                  onClick={() => {
                    setFormData({ name: '', type: 'income', color: '#10B981' });
                    setShowForm(true);
                  }}
                  style={styles.emptyActionButton}
                >
                  Create Income Category
                </button>
              </div>
            ) : (
              <div style={styles.categoryList}>
                {incomeCategories.map(category => (
                  <div 
                    key={category.id} 
                    style={styles.categoryItem}
                    className="categoryItem"
                  >
                    <div style={styles.categoryInfo}>
                      <div style={{
                        ...styles.colorDot,
                        backgroundColor: category.color,
                        border: `2px solid ${category.color}22`
                      }}></div>
                      <div style={styles.categoryDetails}>
                        <span style={styles.categoryName}>{category.name}</span> 
                      </div>
                    </div>
                    <div style={styles.categoryActions}>
                      <button
                        onClick={() => handleEdit(category)}
                        style={styles.editButton}
                        className="editButton"
                        title="Edit category"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
                        style={styles.deleteButton}
                        className="deleteButton"
                        title="Delete category"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.categorySection}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionTitle}>
                <span style={{ 
                  backgroundColor: '#EF4444', 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%',
                  marginRight: '8px',
                  display: 'inline-block'
                }}></span>
                <h3 style={{ color: '#EF4444', fontSize: '18px', margin: 0, display: 'inline' }}>
                  Expense ({expenseCategories.length})
                </h3>
              </div>
              <button
                onClick={() => {
                  setFormData({ name: '', type: 'expense', color: '#EF4444' });
                  setShowForm(true);
                }}
                style={styles.sectionAddButton}
              >
                + Add
              </button>
            </div>
            {expenseCategories.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>📤</div>
                <p style={styles.emptyMessage}>No expense categories yet</p>
                <button
                  onClick={() => {
                    setFormData({ name: '', type: 'expense', color: '#EF4444' });
                    setShowForm(true);
                  }}
                  style={styles.emptyActionButton}
                >
                  Create Expense Category
                </button>
              </div>
            ) : (
              <div style={styles.categoryList}>
                {expenseCategories.map(category => (
                  <div 
                    key={category.id} 
                    style={styles.categoryItem}
                    className="categoryItem"
                  >
                    <div style={styles.categoryInfo}>
                      <div style={{
                        ...styles.colorDot,
                        backgroundColor: category.color,
                        border: `2px solid ${category.color}22`
                      }}></div>
                      <div style={styles.categoryDetails}>
                        <span style={styles.categoryName}>{category.name}</span>
                      </div>
                    </div>
                    <div style={styles.categoryActions}>
                      <button
                        onClick={() => handleEdit(category)}
                        style={styles.editButton}
                        className="editButton"
                        title="Edit category"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
                        style={styles.deleteButton}
                        className="deleteButton"
                        title="Delete category"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    width: '100%',
    maxWidth: '100%',        // tambahin
    overflowX: 'hidden',      // tambahin
    boxSizing: 'border-box',
    minHeight: 'calc(100vh - 200px)',
    position: 'relative',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
  },
  addButton: {
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.3s ease',
  },
  errorAlert: {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    animation: 'fadeIn 0.3s ease',
  },
  errorText: {
    fontSize: '14px',
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: '#DC2626',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    backgroundColor: '#f8fafc',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #e2e8f0',
    flexShrink: 0,
    animation: 'slideDown 0.3s ease',
  },
  formHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  formTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
  },
  formError: {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '15px',
    fontSize: '14px',
  },
  formGroup: {
    marginBottom: '15px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '4px',
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '16px',
    boxSizing: 'border-box',
    backgroundColor: 'white',
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
  },
  charCount: {
    fontSize: '12px',
    color: '#64748b',
    textAlign: 'right',
    marginTop: '4px',
  },
  radioGroup: {
    display: 'flex',
    gap: '15px',
    marginTop: '8px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: '14px',
  },
  radioInput: {
    margin: 0,
    marginRight: '6px',
  },
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '8px',
    marginTop: '8px',
    marginBottom: '10px',
  },
  colorOption: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    cursor: 'pointer',
    border: 'none',
    padding: 0,
    transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
  },
  selectedColorPreview: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '8px',
    padding: '8px',
    backgroundColor: 'white',
    borderRadius: '4px',
    border: '1px solid #e2e8f0',
  },
  colorHex: {
    fontSize: '14px',
    color: '#64748b',
    fontFamily: 'monospace',
  },
  formActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px',
  },
  cancelButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
  submitButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#10B981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    position: 'relative',
  },
  buttonLoading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  buttonSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: '#64748b',
    flex: 1,
  },
  spinner: {
    width: '30px',
    height: '30px',
    border: '3px solid #f1f5f9',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '10px',
  },
  loadingText: {
    fontSize: '14px',
  },
  categoriesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '20px',
    width: '100%',        // tambahin
    maxWidth: '100%',     // tambahin
    boxSizing: 'border-box',
  },
  categorySection: {
    padding: '15px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    width: '100%',        // tambahin
    boxSizing: 'border-box',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    paddingBottom: '10px',
    borderBottom: '2px solid #e2e8f0',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
  },
  sectionAddButton: {
    backgroundColor: 'transparent',
    color: '#3B82F6',
    border: '1px solid #3B82F6',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  emptyState: {
    textAlign: 'center',
    padding: '30px 20px',
  },
  emptyIcon: {
    fontSize: '32px',
    marginBottom: '10px',
    opacity: 0.5,
  },
  emptyMessage: {
    color: '#94a3b8',
    fontSize: '14px',
    margin: '0 0 15px 0',
  },
  emptyActionButton: {
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  categoryList: {
    marginTop: '10px',
  },
  categoryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: 'white',
    borderRadius: '6px',
    marginBottom: '8px',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
  categoryInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
  },
  colorDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  categoryDetails: {
    display: 'lex',
    flexDirection: 'column',
    gap: '2px',
  },
  categoryName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1e293b',
  },
  categoryType: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: '400',
  },
  categoryActions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },
  editButton: {
    padding: '6px 12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.3s ease',
    minWidth: '60px',
    textAlign: 'center',
  },
  deleteButton: {
    padding: '6px 12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.3s ease',
    minWidth: '60px',
    textAlign: 'center',
  },
};

// Add CSS animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideDown {
    from { 
      opacity: 0;
      transform: translateY(-10px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes toastSlideIn {
    from { 
      opacity: 0;
      transform: translateX(100px);
    }
    to { 
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes toastSlideOut {
    from { 
      opacity: 1;
      transform: translateX(0);
    }
    to { 
      opacity: 0;
      transform: translateX(100px);
    }
  }
  
  .addButton:hover {
    background-color: #2563eb !important;
  }
  
  .addButton:active {
    transform: scale(0.98);
  }
  
  .cancelButton:hover {
    background-color: #e2e8f0 !important;
  }
  
  .submitButton:hover:not(:disabled) {
    background-color: #059669 !important;
  }
  
  .submitButton:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .editButton:hover {
    background-color: #2563eb !important;
  }
  
  .deleteButton:hover {
    background-color: #dc2626 !important;
  }
  
  .sectionAddButton:hover {
    background-color: #3B82F6 !important;
    color: white !important;
  }
  
  .emptyActionButton:hover {
    background-color: #2563eb !important;
  }
  
  input:focus {
    outline: none !important;
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
  }
  
  .categoryItem:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;
  }
  
  .closeButton:hover {
    background-color: #e2e8f0;
  }
  
  .colorOption:hover {
    transform: scale(1.05) !important;
  }
  
  @media (min-width: 769px) {
    .categoriesGrid {
      grid-template-columns: repeat(2, 1fr) !important;
    }
    
    .container {
      padding: 30px !important;
    }
    
    .title {
      font-size: 24px !important;
    }
    
    .colorGrid {
      grid-template-columns: repeat(10, 1fr) !important;
    }
    
    .colorOption {
      width: 24px !important;
      height: 24px !important;
    }
    
    .formCard {
      animation: slideDown 0.3s ease !important;
    }
  }
  
  @media (max-width: 768px) {
    .container {
      padding: 15px !important;
    }
    
    .formGroup {
      margin-bottom: 12px !important;
    }
    
    .formActions {
      flex-direction: row !important;
    }
    
    .categoryItem {
      padding: 10px !important;
    }
    
    .sectionHeader {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 10px !important;
    }
    
    .sectionAddButton {
      align-self: flex-end !important;
    }
  }
  
  @media (max-width: 480px) {
    .categoryItem {
      flex-direction: row !important;
      align-items: center !important;
      gap: 10px !important;
    }
    
    .categoryActions {
      width: auto !important;
      justify-content: flex-end !important;
    }
    
    .radioGroup {
      flex-direction: row !important;
      gap: 15px !important;
    }
    
    .formActions {
      flex-direction: row !important;
    }
    
    .header {
      flex-direction: row !important;
    }
    
    .title {
      font-size: 18px !important;
    }
    
    .addButton {
      padding: 8px 12px !important;
      font-size: 13px !important;
    }
    
    .categoryName {
      font-size: 13px !important;
    }
    
    .editButton,
    .deleteButton {
      padding: 5px 10px !important;
      font-size: 11px !important;
      min-width: 50px !important;
    }
  }
  
  @media (max-width: 360px) {
    .categoryActions {
      flex-direction: column !important;
      gap: 4px !important;
    }
    
    .editButton,
    .deleteButton {
      padding: 4px 8px !important;
      font-size: 10px !important;
      min-width: 45px !important;
    }
    
    .colorGrid {
      grid-template-columns: repeat(4, 1fr) !important;
    }
  }
`;
document.head.appendChild(styleSheet);

export default CategoryManager;
