import { useState, useEffect } from 'react';
import { LogIn, UserPlus, Github, AlertCircle, CheckCircle } from 'lucide-react';
import AnalysisPage from './AnalysisPage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://backend-nest-msnd.onrender.com';

// Message Modal bileşeni
const MessageModal = ({ message, onClose }: { 
  message: { text: string, type: 'success' | 'error' }, 
  onClose: () => void 
}) => {
  const isError = message.type === 'error';
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '450px',
        width: '100%',
        textAlign: 'center',
        border: `4px solid ${isError ? '#ef4444' : '#10b981'}`,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        animation: 'slideIn 0.3s ease-out'
      }}>
        <div style={{ 
          marginBottom: '25px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            backgroundColor: isError ? '#fef2f2' : '#f0fdf4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `3px solid ${isError ? '#ef4444' : '#10b981'}`
          }}>
            {isError ? (
              <AlertCircle size={36} color="#ef4444" />
            ) : (
              <CheckCircle size={36} color="#10b981" />
            )}
          </div>
        </div>
        <h3 style={{
          fontSize: '24px',
          fontWeight: '800',
          marginBottom: '15px',
          color: isError ? '#dc2626' : '#059669'
        }}>
          {isError ? 'HATA!' : 'BAŞARILI!'}
        </h3>
        <p style={{ 
          marginBottom: '30px', 
          color: '#4b5563',
          fontSize: '16px',
          lineHeight: '1.6'
        }}>
          {message.text}
        </p>
        <button
          onClick={onClose}
          style={{
            backgroundColor: isError ? '#ef4444' : '#10b981',
            color: 'white',
            border: 'none',
            padding: '15px 40px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            width: '100%',
            transition: 'all 0.3s ease',
            boxShadow: `0 10px 20px ${isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 15px 30px ${isError ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 10px 20px ${isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`;
          }}
        >
          TAMAM
        </button>
      </div>
    </div>
  );
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // Sayfa yüklendiğinde token kontrolü
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUsername = localStorage.getItem('username');
    if (storedToken && storedUsername) {
      setToken(storedToken);
      setUsername(storedUsername);
      setIsLoggedIn(true);
    }
  }, []);

  // Mesaj gösterme fonksiyonu
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
  };

  // Giriş fonksiyonu
  const handleLogin = async (credentials: { username: string; password: string }) => {
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        const newToken = data.access_token;
        const newUsername = data.user.username;
        
        setToken(newToken);
        setUsername(newUsername);
        setIsLoggedIn(true);
        
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('username', newUsername);
        
        showMessage('🎉 Giriş başarılı! Analiz paneline hoş geldiniz.', 'success');
      } else {
        showMessage(`❌ ${data.message || 'Giriş başarısız!'}`, 'error');
      }
    } catch (error) {
      showMessage('🌐 Sunucuya bağlanılamadı! Lütfen internet bağlantınızı kontrol edin.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Kayıt fonksiyonu
  const handleRegister = async (credentials: { username: string; password: string }) => {
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('✅ Kayıt başarılı! Şimdi giriş yapabilirsiniz.', 'success');
        setView('login');
      } else {
        showMessage(`❌ ${data.message || 'Kayıt başarısız!'}`, 'error');
      }
    } catch (error) {
      showMessage('🌐 Sunucuya bağlanılamadı!', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Çıkış fonksiyonu
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    setToken(null);
    setUsername('');
    setIsLoggedIn(false);
    showMessage('👋 Başarıyla çıkış yapıldı. Tekrar görüşmek üzere!', 'success');
  };

  // 1. GİRİŞ/KAYIT EKRANI (MAVİ CONTAINER)
  if (!isLoggedIn) {
    return (
      <>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          minHeight: '100vh',
          padding: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
          {/* MAVİ CONTAINER */}
          <div style={{
            width: '100%',
            maxWidth: '450px',
            backgroundColor: '#ffffff',
            borderRadius: '25px',
            padding: '50px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
            border: 'none',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Dekoratif element */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '8px',
              background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd)'
            }} />
            
            {/* İkon */}
            <div style={{
              width: '90px',
              height: '90px',
              background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 25px',
              boxShadow: '0 10px 30px rgba(59, 130, 246, 0.3)'
            }}>
              {view === 'login' ? (
                <LogIn size={42} color="white" />
              ) : (
                <UserPlus size={42} color="white" />
              )}
            </div>

            {/* Başlık */}
            <h2 style={{
              color: '#1f2937',
              fontSize: '32px',
              fontWeight: '800',
              marginBottom: '10px',
              background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {view === 'login' ? 'GİRİŞ YAP' : 'KAYIT OL'}
            </h2>
            <p style={{ 
              color: '#6b7280', 
              marginBottom: '40px',
              fontSize: '15px',
              fontWeight: '500'
            }}>
              OSS Lisans Analiz Platformu
            </p>

            {/* Form */}
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget as HTMLFormElement);
              const credentials = {
                username: formData.get('username') as string,
                password: formData.get('password') as string,
              };
              
              if (view === 'register') {
                handleRegister(credentials);
              } else {
                handleLogin(credentials);
              }
            }}>
              <div style={{ marginBottom: '25px' }}>
                <input
                  type="text"
                  name="username"
                  placeholder="Kullanıcı Adı"
                  required
                  style={{
                    width: '100%',
                    padding: '18px 20px',
                    borderRadius: '12px',
                    border: '2px solid #e5e7eb',
                    fontSize: '16px',
                    outline: 'none',
                    backgroundColor: '#f9fafb',
                    transition: 'all 0.3s ease',
                    fontWeight: '500'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.backgroundColor = '#ffffff';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.backgroundColor = '#f9fafb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '35px' }}>
                <input
                  type="password"
                  name="password"
                  placeholder="Şifre"
                  required
                  style={{
                    width: '100%',
                    padding: '18px 20px',
                    borderRadius: '12px',
                    border: '2px solid #e5e7eb',
                    fontSize: '16px',
                    outline: 'none',
                    backgroundColor: '#f9fafb',
                    transition: 'all 0.3s ease',
                    fontWeight: '500'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.backgroundColor = '#ffffff';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.backgroundColor = '#f9fafb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '18px',
                  background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '17px',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  marginBottom: '20px',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)'
                }}
                onMouseOver={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 15px 35px rgba(59, 130, 246, 0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.3)';
                  }
                }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    İŞLENİYOR...
                  </span>
                ) : (
                  view === 'login' ? '🔐 GİRİŞ YAP' : '📝 KAYIT OL'
                )}
              </button>

              <button
                type="button"
                onClick={() => setView(view === 'login' ? 'register' : 'login')}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: 'transparent',
                  color: '#3b82f6',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'color 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = '#2563eb';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = '#3b82f6';
                }}
              >
                {view === 'login' ? '📋 Hesabın yok mu? Kayıt Ol' : '🔑 Zaten hesabın var mı? Giriş Yap'}
              </button>
            </form>
          </div>
        </div>
        
        {/* Mesaj Modal */}
        {message && (
          <MessageModal 
            message={message} 
            onClose={() => setMessage(null)} 
          />
        )}
      </>
    );
  }

  // 2. ANA PANEL (YEŞİL CONTAINER)
  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: '100vh',
        padding: '20px',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '1400px'
        }}>
          {/* YEŞİL HEADER CONTAINER */}
          <div style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            borderRadius: '25px',
            padding: '35px',
            marginBottom: '30px',
            border: 'none',
            boxShadow: '0 25px 70px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Dekoratif element */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '8px',
              background: 'linear-gradient(90deg, #34d399, #10b981, #059669)'
            }} />
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '25px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px'
              }}>
                <div style={{
                  width: '70px',
                  height: '70px',
                  background: 'linear-gradient(135deg, #34d399, #10b981)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 30px rgba(52, 211, 153, 0.3)'
                }}>
                  <Github size={32} color="white" />
                </div>
                <div>
                  <h1 style={{
                    color: 'white',
                    fontSize: '36px',
                    fontWeight: '800',
                    marginBottom: '8px',
                    textShadow: '0 2px 10px rgba(0,0,0,0.2)'
                  }}>
                    LİSANS ANALİZ PANELİ
                  </h1>
                  <p style={{ 
                    color: '#a7f3d0', 
                    fontSize: '16px',
                    fontWeight: '500'
                  }}>
                    🎯 Hoş geldin, <strong style={{ color: 'white' }}>{username}</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ANA İÇERİK CONTAINER */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '25px',
            padding: '40px',
            border: 'none',
            boxShadow: '0 25px 70px rgba(0,0,0,0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Dekoratif element */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '8px',
              background: 'linear-gradient(90deg, #10b981, #34d399, #10b981)'
            }} />
            
            {/* AnalysisPage bileşenini token, username ve showMessage ile gönderiyoruz */}
            <AnalysisPage 
              token={token}
              username={username}
              onLogout={handleLogout}
              showMessage={showMessage}
            />
          </div>
        </div>
      </div>
      
      {/* Mesaj Modal */}
      {message && (
        <MessageModal 
          message={message} 
          onClose={() => setMessage(null)} 
        />
      )}
      
      {/* Animasyon için style */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        * {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </>
  );
}

export default App;