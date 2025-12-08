import React, { useState, useEffect, useCallback } from 'react';
// Lucide React ikonlarını kullanmak için gerekli importlar
import { 
  LogIn, 
  UserPlus, 
  LogOut, 
  AlertTriangle, 
  CheckCircle, 
  Github, 
  Package,
  FileText, 
  ShieldAlert,
  ShieldCheck,
  Clock,
  Activity,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import AnalysisPage from './AnalysisPage';

// API adresi: Docker'da ortam değişkeninden, yerelde 'http://localhost:3000' olarak alınır.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://backend-nest-msnd.onrender.com';

// Global Message State Tipi
interface Message {
    text: string;
    type: 'success' | 'error';
}

// Analysis Interface
interface Analysis {
  id: number;
  githubUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  sbomData?: any;
  licenseReport?: any;
}

// ------------------------------------------------------------------
// ORTAK BİLEŞENLER
// ------------------------------------------------------------------

// Hata/Başarı Mesajları için Modal Bileşeni (Geliştirilmiş Tasarım)
const MessageModal: React.FC<{ message: Message, onClose: () => void }> = ({ message, onClose }) => {
  const isError = message.type === 'error';
  const title = isError ? 'Hata!' : 'Başarılı!';
  const icon = isError ? <AlertTriangle className="w-6 h-6 text-red-600" /> : <CheckCircle className="w-6 h-6 text-green-600" />;
  const buttonBg = isError ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
      <div className={`bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border-l-4 ${isError ? 'border-red-600' : 'border-green-600'}`}>
        <div className="flex items-center space-x-3">
          {icon}
          <h3 className={`text-xl font-bold ${isError ? 'text-red-700' : 'text-green-700'}`}>{title}</h3>
        </div>
        <p className="mt-4 text-gray-700 text-sm">{message.text}</p>
        <button
          onClick={onClose}
          className={`mt-6 w-full py-2 rounded-lg font-semibold text-white ${buttonBg} transition shadow-md`}
        >
          Kapat
        </button>
      </div>
    </div>
  );
};

// Yükleme Animasyonu Bileşeni
const LoadingSpinner: React.FC<{ message?: string, color?: string }> = ({ message = "Yükleniyor...", color = "bg-indigo-600" }) => (
    <div className="flex flex-col items-center justify-center p-2">
        <div className="flex space-x-2">
            <div className={`w-3 h-3 ${color} rounded-full animate-bounce`}></div>
            <div className={`w-3 h-3 ${color} rounded-full animate-bounce delay-150`}></div>
            <div className={`w-3 h-3 ${color} rounded-full animate-bounce delay-300`}></div>
        </div>
        <p className="mt-2 text-xs text-indigo-700 font-medium">{message}</p>
    </div>
);

// ------------------------------------------------------------------
// ANA UYGULAMA MANTIĞI
// ------------------------------------------------------------------

const App: React.FC = () => {
  // State Yönetimi
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [view, setView] = useState<'login' | 'register' | 'dashboard' | 'analysis'>('login');
  const [message, setMessage] = useState<Message | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Lokal Depolamadan Token Kontrolü (Uygulama Yüklendiğinde)
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUsername = localStorage.getItem('username');
    if (storedToken && storedUsername) {
      setToken(storedToken);
      setUsername(storedUsername);
      setIsLoggedIn(true);
      setView('dashboard');
      fetchAnalyses();
    }
  }, []);

  // Hata/Başarı Mesajını Gösterme Fonksiyonu
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
  };

  // JWT Token'lı API İsteklerini Yöneten Ortak Fonksiyon
  const authenticatedFetch = useCallback(async (url: string, options: RequestInit = {}, retries: number = 3) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, { ...options, headers });
            
            if (response.status === 401) {
                // Token temizle ve kullanıcıyı giriş sayfasına yönlendir
                localStorage.removeItem('authToken');
                localStorage.removeItem('username');
                setIsLoggedIn(false);
                setToken(null);
                setUsername('');
                setView('login');
                showMessage('Oturum süreniz doldu veya yetkiniz yok. Lütfen tekrar giriş yapın.', 'error');
                return { success: false, status: 401 };
            }

            const isJson = response.headers.get('content-type')?.includes('application/json');
            const data = isJson ? await response.json() : {};

            if (!response.ok) {
                throw new Error(data.message || `API Hatası: ${response.status} - ${response.statusText}`);
            }

            return { success: true, data, status: response.status };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen Hata';
            console.error('Fetch hatası:', errorMessage);
            
            if (i === retries - 1) {
                showMessage(`Sunucuya erişilemiyor veya bilinmeyen bir hata oluştu: ${errorMessage}`, 'error');
                return { success: false, error: errorMessage };
            }

            const delay = Math.pow(2, i) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return { success: false, error: 'Tüm denemeler başarısız oldu.' };
  }, [token]);

  // Analiz Geçmişini Çekme Fonksiyonu
  const fetchAnalyses = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    const result = await authenticatedFetch(`${API_BASE_URL}/analysis`);
    
    setIsLoading(false);

    if (result.success) {
        setAnalyses(Array.isArray(result.data) ? result.data : []);
    } else if (result.status !== 401) {
        showMessage(result.error || 'Analiz geçmişi yüklenirken bir hata oluştu.', 'error');
    }
  }, [authenticatedFetch, token]);

  // Giriş/Kayıt İşlemleri
  const handleAuth = async (isRegister: boolean, credentials: Record<string, string>) => {
    setIsLoading(true);
    const endpoint = isRegister ? 'register' : 'login';

    const result = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    setIsLoading(false);
    
    const isJson = result.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await result.json() : {};

    if (result.ok) {
      if (!isRegister) {
        const newToken = data.access_token as string;
        const newUsername = data.user.username as string;
        setToken(newToken);
        setUsername(newUsername);
        setIsLoggedIn(true);
        setView('dashboard');
        
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('username', newUsername);
        
        fetchAnalyses();
        showMessage('Giriş başarılı! Lisans Analiz Dashboard\'una hoş geldiniz.', 'success');
      } else {
        showMessage('Kayıt başarılı! Şimdi giriş yapabilirsiniz.', 'success');
        setView('login');
      }
    } else {
      showMessage(data.message || `Bir hata oluştu (${result.status}). Lütfen tekrar deneyin.`, 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    setToken(null);
    setUsername('');
    setIsLoggedIn(false);
    setAnalyses([]);
    setView('login');
    showMessage('Başarıyla çıkış yapıldı.', 'success');
  };

  // Dashboard'a geçildiğinde analizleri yükle
  useEffect(() => {
    if (isLoggedIn && view === 'dashboard') {
      fetchAnalyses();
    }
  }, [isLoggedIn, view, fetchAnalyses]);

  // ------------------------------------------------------------------
  // GÜZEL TASARIMLI BİLEŞENLER
  // ------------------------------------------------------------------

  const AuthForm: React.FC<{ type: 'login' | 'register' }> = ({ type }) => {
    const isRegister = type === 'register';
    const [credentials, setCredentials] = useState({ username: '', password: '' });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCredentials({ ...credentials, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleAuth(isRegister, credentials);
    };

    const title = isRegister ? 'Yeni Hesap Oluştur' : 'Giriş Yap';
    const icon = isRegister ? <UserPlus className="w-8 h-8 text-indigo-500" /> : <LogIn className="w-8 h-8 text-indigo-500" />;

    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4">
        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md transform hover:shadow-3xl transition duration-500 ease-in-out border-t-8 border-indigo-600">
          <div className="flex flex-col items-center mb-6">
            <div className="p-3 bg-indigo-100 rounded-full mb-3 shadow-inner">
                {icon}
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900">{title}</h2>
            <p className="text-gray-600 text-sm mt-2 text-center">
              {isRegister ? 'Lisans analiz platformuna kayıt olun' : 'Lisans analiz platformuna giriş yapın'}
            </p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="username">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                name="username"
                value={credentials.username}
                onChange={handleChange}
                required
                className="w-full py-3 px-4 border border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 transition duration-300"
                placeholder="Kullanıcı adınızı girin"
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="password">
                Şifre
              </label>
              <input
                type="password"
                name="password"
                value={credentials.password}
                onChange={handleChange}
                required
                className="w-full py-3 px-4 border border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 transition duration-300"
                placeholder="Şifrenizi girin"
              />
            </div>
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition duration-300 shadow-lg hover:shadow-xl disabled:bg-indigo-400"
              >
                {isLoading ? <LoadingSpinner message="İşleniyor..." color="bg-white" /> : (
                    <>
                        {isRegister ? 'Kayıt Ol' : 'Giriş Yap'}
                        {!isLoading && <LogIn className="w-5 h-5 ml-2" />}
                    </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setView(isRegister ? 'login' : 'register')}
                className="w-full text-sm text-center text-indigo-500 hover:text-indigo-700 transition duration-300 py-2"
              >
                {isRegister ? 'Zaten hesabım var, Giriş Yap' : 'Hesabın yok mu? Yeni Hesap Oluştur'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };
  
  // Analiz Kartı Bileşeni
  const AnalysisCard: React.FC<{ analysis: Analysis }> = ({ analysis }) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'completed': return 'bg-green-100 text-green-800 border-green-300';
        case 'processing': return 'bg-blue-100 text-blue-800 border-blue-300';
        case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'failed': return 'bg-red-100 text-red-800 border-red-300';
        default: return 'bg-gray-100 text-gray-800 border-gray-300';
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'completed': return <ShieldCheck className="w-4 h-4" />;
        case 'processing': return <Activity className="w-4 h-4" />;
        case 'pending': return <Clock className="w-4 h-4" />;
        case 'failed': return <ShieldAlert className="w-4 h-4" />;
        default: return <FileText className="w-4 h-4" />;
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'completed': return 'Tamamlandı';
        case 'processing': return 'İşleniyor';
        case 'pending': return 'Bekliyor';
        case 'failed': return 'Başarısız';
        default: return 'Bilinmeyen';
      }
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const getRepoName = (url: string) => {
      try {
        const urlObj = new URL(url);
        return urlObj.pathname.split('/').pop() || url;
      } catch {
        return url;
      }
    };

    const getStats = () => {
      if (analysis.licenseReport?.summary) {
        const { total, compliant, nonCompliant, needsReview } = analysis.licenseReport.summary;
        return { total, compliant, nonCompliant, needsReview };
      }
      return { total: 0, compliant: 0, nonCompliant: 0, needsReview: 0 };
    };

    const stats = getStats();

    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 hover:shadow-xl transition-shadow duration-300">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <Github className="w-5 h-5" />
              {getRepoName(analysis.githubUrl)}
            </h3>
            <p className="text-sm text-gray-600 mt-1 truncate">{analysis.githubUrl}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 border ${getStatusColor(analysis.status)}`}>
            {getStatusIcon(analysis.status)}
            {getStatusText(analysis.status)}
          </div>
        </div>

        {analysis.status === 'completed' && stats.total > 0 && (
          <div className="mb-4">
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-700">{stats.compliant}</div>
                <div className="text-xs text-green-600">Uyumlu</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-700">{stats.nonCompliant}</div>
                <div className="text-xs text-red-600">Yasaklı</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-700">{stats.needsReview}</div>
                <div className="text-xs text-yellow-600">İnceleme</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
                <div className="text-xs text-blue-600">Toplam</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatDate(analysis.createdAt)}
          </span>
          <button
            onClick={() => {
              setView('analysis');
              // Burada analiz detay sayfasına yönlendirme yapılabilir
            }}
            className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
          >
            Detayları Gör
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };
  
  // Dashboard Bileşeni (YENİ - Analiz Dashboard'u)
  const Dashboard: React.FC = () => {
    const totalAnalyses = analyses.length;
    const completedAnalyses = analyses.filter(a => a.status === 'completed').length;
    const failedAnalyses = analyses.filter(a => a.status === 'failed').length;

    const totalPackages = analyses.reduce((sum, analysis) => {
      if (analysis.licenseReport?.summary?.total) {
        return sum + analysis.licenseReport.summary.total;
      }
      return sum;
    }, 0);

    return (
      <div className="p-4 sm:p-8 min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 font-sans">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 bg-white p-6 rounded-2xl shadow-2xl sticky top-0 z-10 border-l-8 border-indigo-600">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="p-3 bg-indigo-100 rounded-xl mr-4">
              <ShieldCheck className="w-10 h-10 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-indigo-800">Lisans Analiz Dashboard'u</h1>
              <p className="text-gray-600">
                Hoş Geldiniz, <strong className="font-extrabold text-indigo-600">{username}</strong>
              </p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-3 md:space-y-0 md:space-x-4 w-full md:w-auto">
            {/* Navigasyon Butonları */}
            <div className="flex space-x-2">
              <button
                onClick={() => setView('dashboard')}
                className="bg-indigo-600 text-white font-semibold py-2.5 px-5 rounded-xl transition shadow-md flex items-center space-x-2 hover:bg-indigo-700"
              >
                <BarChart3 className="w-5 h-5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setView('analysis')}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-5 rounded-xl transition shadow-md flex items-center space-x-2"
              >
                <Github className="w-5 h-5" />
                <span>Yeni Analiz</span>
              </button>
            </div>
            
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-5 rounded-xl transition shadow-md flex items-center space-x-2"
              title="Çıkış Yap"
            >
              <LogOut className="w-5 h-5" />
              <span>Çıkış Yap</span>
            </button>
          </div>
        </header>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Toplam Analiz</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{totalAnalyses}</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-xl">
                <FileText className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Tamamlananlar</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{completedAnalyses}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <ShieldCheck className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Başarısız Analizler</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{failedAnalyses}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <ShieldAlert className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Toplam Paket</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{totalPackages}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Analiz Geçmişi */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Clock className="w-7 h-7 text-indigo-600" />
              Analiz Geçmişi
            </h2>
            <button
              onClick={fetchAnalyses}
              disabled={isLoading}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition flex items-center gap-2"
            >
              {isLoading ? <LoadingSpinner message="" color="bg-gray-600" /> : 'Yenile'}
            </button>
          </div>

          {isLoading && analyses.length === 0 ? (
            <div className="flex justify-center items-center h-48">
              <LoadingSpinner message="Analiz geçmişi yükleniyor..." />
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Henüz analiz yapılmadı</h3>
              <p className="text-gray-500 mb-6">İlk analizinizi yapmak için "Yeni Analiz" butonuna tıklayın</p>
              <button
                onClick={() => setView('analysis')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition shadow-md flex items-center space-x-2 mx-auto"
              >
                <Github className="w-5 h-5" />
                <span>İlk Analizi Başlat</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {analyses.slice(0, 6).map((analysis) => (
                <AnalysisCard key={analysis.id} analysis={analysis} />
              ))}
            </div>
          )}

          {analyses.length > 6 && (
            <div className="mt-8 text-center">
              <button className="text-indigo-600 hover:text-indigo-800 font-medium">
                Tüm analiz geçmişini görüntüle ({analyses.length} analiz)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ------------------------------------------------------------------
  // ANA RENDER
  // ------------------------------------------------------------------

  const renderContent = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard />;
      case 'analysis':
        return <AnalysisPage 
          token={token}
          username={username}
          onLogout={handleLogout}
          showMessage={showMessage}
          onAnalysisCreated={() => {
            setView('dashboard');
            fetchAnalyses();
          }}
        />;
      case 'register':
        return <AuthForm type="register" />;
      case 'login':
      default:
        return <AuthForm type="login" />;
    }
  };

  return (
    <>
      {renderContent()}
      {message && <MessageModal message={message} onClose={() => setMessage(null)} />}
    </>
  );
};

export default App;