import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function AuthForm({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleSwitch = () => {
    setIsTransitioning(true);
    setError('');
    
    setTimeout(() => {
      setIsLogin(!isLogin);
      setPassword('');
      setIsTransitioning(false);
    }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('Email atau password salah');
          } else if (error.message.includes('Email not confirmed')) {
            setError('Email belum dikonfirmasi. Silakan cek email Anda.');
          } else {
            setError(error.message);
          }
          return;
        }

        console.log('Login successful:', data);
        if (onLogin) onLogin();
        
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (error) {
          if (error.message.includes('User already registered')) {
            setError('Email sudah terdaftar. Silakan login.');
          } else {
            setError(error.message);
          }
          return;
        }

        alert('Pendaftaran berhasil! Silakan cek email Anda untuk konfirmasi.');
        setIsLogin(true);
        setPassword('');
        setEmail('');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={{
        ...styles.card,
        opacity: isTransitioning ? 0.7 : 1,
        transform: isTransitioning ? 'translateY(10px)' : 'translateY(0)'
      }}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <div style={styles.logo}>
              <svg viewBox="0 0 24 24" style={styles.logoSvg}>
                <path d="M3 6h18v12H3z" fill="#8fd7f9ff" opacity="0.2"/>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" 
                      stroke="#46a5e5ff" strokeWidth="2" fill="none"/>
              </svg>
            </div>
            <div>
              <h1 style={styles.title}>MoneyTracker</h1>
              <p style={styles.subtitle}>Kelola Keuangan dengan Mudah</p>
            </div>
          </div>
        </div>

        {/* Toggle */}
        <div style={styles.toggleContainer}>
          <div style={styles.toggle}>
            <button
              onClick={() => !isLogin && handleSwitch()}
              style={{
                ...styles.toggleButton,
                ...(isLogin ? styles.toggleButtonActive : {}),
                opacity: isLoading || isTransitioning ? 0.7 : 1
              }}
              disabled={isLoading || isTransitioning}
            >
              Masuk
            </button>
            <button
              onClick={() => isLogin && handleSwitch()}
              style={{
                ...styles.toggleButton,
                ...(!isLogin ? styles.toggleButtonActive : {}),
                opacity: isLoading || isTransitioning ? 0.7 : 1
              }}
              disabled={isLoading || isTransitioning}
            >
              Daftar
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <div style={styles.inputWrapper}>
              <svg style={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" 
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22,6 12,13 2,6" 
                         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                placeholder="nama@email.com"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <svg style={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" 
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" 
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder={isLogin ? "Masukkan password" : "Buat password (minimal 6 karakter)"}
                required
                minLength="6"
                disabled={isLoading}
              />
            </div>
            {!isLogin && (
              <div style={styles.hint}>
                <svg style={styles.hintIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                  <line x1="12" y1="8" x2="12" y2="12" strokeWidth="1.5"/>
                  <line x1="12" y1="16" x2="12" y2="16" strokeWidth="1.5"/>
                </svg>
                <span style={styles.hintText}>Minimal 6 karakter</span>
              </div>
            )}
          </div>

          {error && (
            <div style={styles.error}>
              <svg style={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
                <line x1="12" y1="8" x2="12" y2="12" strokeWidth="1.5"/>
                <line x1="12" y1="16" x2="12" y2="16" strokeWidth="1.5"/>
              </svg>
              <div>
                <p style={styles.errorText}>{error}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            style={{
              ...styles.submitButton,
              ...(isLogin ? styles.loginButton : styles.registerButton),
              opacity: isLoading ? 0.8 : 1
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div style={styles.spinner}></div>
                <span>{isLogin ? 'Memproses...' : 'Mendaftarkan...'}</span>
              </>
            ) : (
              <>
                <svg style={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  {isLogin ? (
                    <path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" 
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  ) : (
                    <>
                      <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" 
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </>
                  )}
                </svg>
                <span>{isLogin ? 'Masuk' : 'Buat Akun'}</span>
              </>
            )}
          </button>
        </form>

        {/* Demo Account */}
        <div style={styles.demo}>
          <div style={styles.demoHeader}>
            <svg style={styles.demoIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" 
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3 style={styles.demoTitle}>Akun Demo</h3>
          </div>
          <div style={styles.demoContent}>
            <div style={styles.demoRow}>
              <span style={styles.demoLabel}>Email:</span>
              <code style={styles.demoValue}>test@example.com</code>
            </div>
            <div style={styles.demoRow}>
              <span style={styles.demoLabel}>Password:</span>
              <code style={styles.demoValue}>test123</code>
            </div>
            <p style={styles.demoNote}>
              Gunakan untuk mencoba aplikasi tanpa mendaftar
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'}
            {' '}
            <button
              onClick={handleSwitch}
              style={styles.switchButton}
              disabled={isLoading}
            >
              {isLogin ? 'Daftar' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #c9e9ffff 0%, #c0e5fdff 100%)', // Biru sangat muda yang soft
    padding: '20px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    position: 'relative'
  },
  card: {
    background: 'white',
    borderRadius: '20px',
    padding: '48px 40px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
    width: '100%',
    maxWidth: '440px',
    transition: 'all 0.3s ease'
  },
  header: {
    marginBottom: '32px'
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '8px'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoSvg: {
    width: '48px',
    height: '48px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1f2937',
    margin: '0',
    lineHeight: '1.2'
  },
  subtitle: {
    fontSize: '15px',
    color: '#6b7280',
    margin: '0',
    fontWeight: '500'
  },
  toggleContainer: {
    marginBottom: '32px'
  },
  toggle: {
    display: 'flex',
    background: '#f3f4f6',
    borderRadius: '12px',
    padding: '4px'
  },
  toggleButton: {
    flex: '1',
    padding: '12px 16px',
    border: 'none',
    background: 'transparent',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit'
  },
  toggleButtonActive: {
    background: 'white',
    color: '#4690e5ff',
    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.1)'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151'
  },
  inputWrapper: {
    position: 'relative'
  },
  inputIcon: {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '20px',
    height: '20px',
    color: '#9ca3af'
  },
  input: {
    width: '100%',
    padding: '14px 16px 14px 48px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '15px',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box'
  },
  inputFocus: {
    borderColor: '#4686e5ff',
    boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.1)',
    outline: 'none'
  },
  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '6px'
  },
  hintIcon: {
    width: '16px',
    height: '16px',
    color: '#9ca3af'
  },
  hintText: {
    fontSize: '13px',
    color: '#6b7280'
  },
  error: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    color: '#dc2626'
  },
  errorIcon: {
    width: '20px',
    height: '20px',
    flexShrink: '0',
    marginTop: '1px'
  },
  errorText: {
    margin: '0',
    fontSize: '14px',
    lineHeight: '1.5'
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '16px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: 'white'
  },
  loginButton: {
    background: '#4690e5ff'
  },
  registerButton: {
    background: '#059669'
  },
  buttonIcon: {
    width: '20px',
    height: '20px',
    stroke: 'white'
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  demo: {
    marginTop: '32px',
    padding: '20px',
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '12px'
  },
  demoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px'
  },
  demoIcon: {
    width: '20px',
    height: '20px',
    color: '#0369a1'
  },
  demoTitle: {
    margin: '0',
    fontSize: '15px',
    fontWeight: '600',
    color: '#0369a1'
  },
  demoContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  demoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  demoLabel: {
    fontSize: '14px',
    color: '#475569',
    fontWeight: '500'
  },
  demoValue: {
    fontSize: '14px',
    fontFamily: "'JetBrains Mono', monospace",
    background: 'white',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    color: '#1e293b'
  },
  demoNote: {
    margin: '8px 0 0 0',
    fontSize: '13px',
    color: '#64748b',
    fontStyle: 'italic'
  },
  footer: {
    marginTop: '24px',
    paddingTop: '24px',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center'
  },
  footerText: {
    margin: '0',
    fontSize: '15px',
    color: '#6b7280'
  },
  switchButton: {
    background: 'none',
    border: 'none',
    color: '#46a0e5ff',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '4px 8px',
    fontSize: '15px',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease'
  }
};

// Add CSS animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .auth-card {
      animation: slideIn 0.4s ease-out;
    }
    
    input:focus {
      border-color: #4696e5ff !important;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1) !important;
      outline: none;
    }
    
    button:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
    
    .toggle-button:hover:not(.active):not(:disabled) {
      background: #e5e7eb;
    }
    
    .submit-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    }
    
    .switch-button:hover:not(:disabled) {
      color: #4338ca;
      text-decoration: underline;
    }
    
    @media (max-width: 480px) {
      .auth-card {
        padding: 32px 24px !important;
        margin: 0 16px;
      }
      
      .logo-container {
        flex-direction: column;
        text-align: center;
        gap: 12px;
      }
      
      .demo-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
    }
  `;
  document.head.appendChild(style);
}

export default AuthForm;