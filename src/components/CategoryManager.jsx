import React, { useState, useEffect } from 'react';
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

  // Warna preset untuk kategori
  const colorOptions = [
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#6B7280', // Gray
    '#84CC16', // Lime
    '#F97316', // Orange
    '#6366F1', // Indigo
  ];

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('type')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      alert('Failed to load categories');
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
      alert('Category name is required');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const categoryData = {
        user_id: user.id,
        name: formData.name.trim(),
        type: formData.type,
        color: formData.color
      };

      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', editingCategory.id);
        
        if (error) throw error;
        alert('Category updated successfully!');
      } else {
        // Create new category
        const { error } = await supabase
          .from('categories')
          .insert([categoryData]);
        
        if (error) throw error;
        alert('Category created successfully!');
      }

      // Reset form and refresh
      setShowForm(false);
      setEditingCategory(null);
      setFormData({ name: '', type: 'expense', color: '#3B82F6' });
      fetchCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Error: ' + error.message);
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
  };

  const handleDelete = async (category) => {
    // Check if category is used in transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id')
      .eq('category_id', category.id)
      .limit(1);

    if (transactions && transactions.length > 0) {
      alert(`Cannot delete "${category.name}" because it is used in ${transactions.length} transaction(s). Please reassign or delete those transactions first.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id);
      
      if (error) throw error;
      alert('Category deleted successfully!');
      fetchCategories();
    } catch (error) {
      alert('Delete failed: ' + error.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCategory(null);
    setFormData({ name: '', type: 'expense', color: '#3B82F6' });
  };

  // Filter categories by type
  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Manage Categories</h2>
        <button
          onClick={() => setShowForm(true)}
          style={styles.addButton}
        >
          + Add New Category
        </button>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3>{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={styles.formGroup}>
              <label>Category Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Food, Transportation, Salary"
                required
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label>Type *</label>
              <div style={styles.radioGroup}>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="type"
                    value="income"
                    checked={formData.type === 'income'}
                    onChange={handleInputChange}
                  />
                  <span style={{ color: '#10B981', marginLeft: '8px' }}>Income</span>
                </label>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="type"
                    value="expense"
                    checked={formData.type === 'expense'}
                    onChange={handleInputChange}
                  />
                  <span style={{ color: '#EF4444', marginLeft: '8px' }}>Expense</span>
                </label>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label>Color</label>
              <div style={styles.colorGrid}>
                {colorOptions.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    style={{
                      ...styles.colorOption,
                      backgroundColor: color,
                      border: formData.color === color ? '3px solid #000' : '1px solid #ddd'
                    }}
                    title={color}
                  />
                ))}
              </div>
              <div style={styles.selectedColor}>
                Selected: 
                <span style={{
                  display: 'inline-block',
                  width: '20px',
                  height: '20px',
                  backgroundColor: formData.color,
                  marginLeft: '10px',
                  borderRadius: '4px',
                  verticalAlign: 'middle'
                }}></span>
                <span style={{ marginLeft: '10px' }}>{formData.color}</span>
              </div>
            </div>

            <div style={styles.formActions}>
              <button
                type="button"
                onClick={handleCancel}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={styles.submitButton}
              >
                {editingCategory ? 'Update Category' : 'Create Category'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={styles.loading}>Loading categories...</div>
      ) : (
        <div style={styles.categoriesGrid}>
          <div style={styles.categorySection}>
            <h3 style={{ color: '#10B981' }}>Income Categories ({incomeCategories.length})</h3>
            {incomeCategories.length === 0 ? (
              <p style={styles.emptyMessage}>No income categories yet</p>
            ) : (
              <div style={styles.categoryList}>
                {incomeCategories.map(category => (
                  <div key={category.id} style={styles.categoryItem}>
                    <div style={styles.categoryInfo}>
                      <div style={{
                        ...styles.colorDot,
                        backgroundColor: category.color
                      }}></div>
                      <span style={styles.categoryName}>{category.name}</span>
                    </div>
                    <div style={styles.categoryActions}>
                      <button
                        onClick={() => handleEdit(category)}
                        style={styles.editButton}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
                        style={styles.deleteButton}
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
            <h3 style={{ color: '#EF4444' }}>Expense Categories ({expenseCategories.length})</h3>
            {expenseCategories.length === 0 ? (
              <p style={styles.emptyMessage}>No expense categories yet</p>
            ) : (
              <div style={styles.categoryList}>
                {expenseCategories.map(category => (
                  <div key={category.id} style={styles.categoryItem}>
                    <div style={styles.categoryInfo}>
                      <div style={{
                        ...styles.colorDot,
                        backgroundColor: category.color
                      }}></div>
                      <span style={styles.categoryName}>{category.name}</span>
                    </div>
                    <div style={styles.categoryActions}>
                      <button
                        onClick={() => handleEdit(category)}
                        style={styles.editButton}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
                        style={styles.deleteButton}
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
  addButton: {
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  formCard: {
    backgroundColor: '#f8fafc',
    padding: '25px',
    borderRadius: '10px',
    marginBottom: '30px',
    border: '1px solid #e2e8f0',
  },
  formGroup: {
    marginBottom: '20px',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '16px',
    marginTop: '5px',
  },
  radioGroup: {
    display: 'flex',
    gap: '20px',
    marginTop: '8px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '10px',
    marginTop: '10px',
  },
  colorOption: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    cursor: 'pointer',
    border: 'none',
    padding: 0,
  },
  selectedColor: {
    marginTop: '15px',
    fontSize: '14px',
    color: '#666',
  },
  formActions: {
    display: 'flex',
    gap: '15px',
    marginTop: '25px',
  },
  cancelButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#f8f9fa',
    color: '#6c757d',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
  },
  submitButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#10B981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
  },
  categoriesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '30px',
  },
  categorySection: {
    padding: '20px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
  },
  emptyMessage: {
    color: '#94a3b8',
    textAlign: 'center',
    padding: '20px',
  },
  categoryList: {
    marginTop: '15px',
  },
  categoryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    borderBottom: '1px solid #f1f5f9',
  },
  categoryInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  colorDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
  },
  categoryName: {
    fontSize: '16px',
    fontWeight: '500',
  },
  categoryActions: {
    display: 'flex',
    gap: '8px',
  },
  editButton: {
    padding: '6px 12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '6px 12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
};

export default CategoryManager;