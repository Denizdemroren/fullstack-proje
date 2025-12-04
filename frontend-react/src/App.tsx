import React, { useState, useEffect, useCallback } from 'react';
// Lucide React ikonlarını kullanmak için gerekli importlar
import { LogIn, UserPlus, LogOut, Package, Trash2, Edit2, PlusCircle, AlertTriangle, CheckCircle, XCircle, Github } from 'lucide-react';
import AnalysisPage from './AnalysisPage';

// API adresi: Docker'da ortam değişkeninden, yerelde 'http://localhost:3000' olarak alınır.
// Bu yapı, React'in bir build ortamından çalışması için kritik öneme sahiptir.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://backend-nest-msnd.onrender.com';interface Product {
  id: number;
  name: string;
  price: number | string;
}

// Global Message State Tipi
interface Message {
    text: string;
    type: 'success' | 'error';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Düzenlenmekte olan ürünü tutar (Update işlemi için yeni state)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null); 

  // Lokal Depolamadan Token Kontrolü (Uygulama Yüklendiğinde)
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUsername = localStorage.getItem('username');
    if (storedToken && storedUsername) {
      setToken(storedToken);
      setUsername(storedUsername);
      setIsLoggedIn(true);
      setView('dashboard');
    }
  }, []);

  // Hata/Başarı Mesajını Gösterme Fonksiyonu
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
  };

  // JWT Token'lı API İsteklerini Yöneten Ortak Fonksiyon (Exponential Backoff ile)
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
                // Hata mesajını backend'den al
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


  // Ürünleri Çekme Fonksiyonu
  const fetchProducts = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    // GET isteği için body veya Content-Type gereksiz, sadece token yeterli
    const result = await authenticatedFetch(`${API_BASE_URL}/products`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' } // Sadece token için headers'ı koru
    });
    
    setIsLoading(false);

    if (result.success) {
        setProducts(Array.isArray(result.data) ? result.data : []);
    } else if (result.status !== 401) {
        showMessage(result.error || 'Ürünler yüklenirken bir hata oluştu.', 'error');
    }
  }, [authenticatedFetch, token]);

  // Giriş/Kayıt İşlemleri (Mevcut haliyle bırakıldı)
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
        
        showMessage('Giriş başarılı! Yönetim paneline hoş geldiniz.', 'success');
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
    setProducts([]);
    setView('login');
    showMessage('Başarıyla çıkış yapıldı.', 'success');
  };

  // ------------------------------------------------------------------
  // YENİ/GÜNCELLENMİŞ CRUD İŞLEMLERİ
  // ------------------------------------------------------------------

  // Ürün Ekleme (Mevcut haliyle bırakıldı)
  const handleAddProduct = async (productData: Omit<Product, 'id'>) => {
    setIsLoading(true);
    const result = await authenticatedFetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        body: JSON.stringify(productData)
    });
    setIsLoading(false);

    if (result.success) {
        showMessage('Ürün başarıyla eklendi.', 'success');
        fetchProducts();
    } else if (result.status !== 401) {
        showMessage(result.error || 'Ürün eklenirken hata oluştu.', 'error');
    }
  };
  
  // Ürün Güncelleme (YENİ)
  const handleUpdateProduct = async (id: number, productData: Omit<Product, 'id'>) => {
    setIsLoading(true);
    const result = await authenticatedFetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(productData)
    });
    setIsLoading(false);

    if (result.success) {
        showMessage('Ürün başarıyla güncellendi.', 'success');
        setEditingProduct(null); // Düzenleme modundan çık
        fetchProducts(); // Listeyi yenile
    } else if (result.status !== 401) {
        showMessage(result.error || 'Ürün güncellenirken hata oluştu.', 'error');
    }
  };

  // Ürün Silme (Mevcut haliyle bırakıldı)
  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
        return;
    }

    setIsLoading(true);
    const result = await authenticatedFetch(`${API_BASE_URL}/products/${id}`, {
        method: 'DELETE'
    });
    setIsLoading(false);

    if (result.success || result.status === 204) { 
        showMessage('Ürün başarıyla silindi.', 'success');
        fetchProducts();
    } else if (result.status !== 401) {
        showMessage(result.error || 'Ürün silinirken hata oluştu.', 'error');
    }
  };
  
  // Düzenleme modunu başlatma
  const startEdit = (product: Product) => {
      setEditingProduct(product);
      // Düzenleme formu göründüğünde sayfayı yukarı kaydır
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };
  
  // Düzenleme modundan çıkma
  const cancelEdit = () => {
      setEditingProduct(null);
  };

  // Dashboard'a geçildiğinde ürünleri yükle
  useEffect(() => {
    if (isLoggedIn && view === 'dashboard') {
      fetchProducts();
    }
  }, [isLoggedIn, view, fetchProducts]);

  // ------------------------------------------------------------------
  // GÜZEL TASARIMLI BİLEŞENLER (Güncellendi)
  // ------------------------------------------------------------------

  const AuthForm: React.FC<{ type: 'login' | 'register' }> = ({ type }) => {
    // ... AuthForm içeriği (Değişmedi)
    const isRegister = type === 'register';
    const [credentials, setCredentials] = useState({ username: '', password: '' });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCredentials({ ...credentials, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleAuth(isRegister, credentials);
    };

    const title = isRegister ? 'Yeni Yönetici Hesabı Oluştur' : 'Yönetici Girişi';
    const icon = isRegister ? <UserPlus className="w-8 h-8 text-indigo-500" /> : <LogIn className="w-8 h-8 text-indigo-500" />;

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md transform hover:shadow-3xl transition duration-500 ease-in-out border-t-8 border-indigo-600">
          <div className="flex flex-col items-center mb-6">
            <div className="p-3 bg-indigo-100 rounded-full mb-3 shadow-inner">
                {icon}
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900">{title}</h2>
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
  
  // ProductForm Bileşeni hem Ekleme hem de Düzenleme için GENİŞLETİLDİ
  interface ProductFormProps {
    onSave: (data: Omit<Product, 'id'>) => Promise<void>;
    onUpdate?: (id: number, data: Omit<Product, 'id'>) => Promise<void>;
    initialData?: Product | null;
    onCancel?: () => void;
  }
  
  const ProductForm: React.FC<ProductFormProps> = ({ onSave, onUpdate, initialData, onCancel }) => {
    const isEditing = !!initialData;
    
    // Düzenleme modunda başlangıç verilerini kullan, ekleme modunda boş bırak
    const [product, setProduct] = useState({ 
        name: initialData?.name || '', 
        price: initialData?.price.toString() || '' 
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        
        // Fiyat alanında sadece sayısal girişlere izin ver
        if (name === 'price') {
            const sanitizedValue = value.replace(/[^0-9.]/g, '');
            setProduct({ ...product, [name]: sanitizedValue });
        } else {
            setProduct({ ...product, [name]: value });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const priceValue = parseFloat(product.price);
        
        if (!product.name || isNaN(priceValue) || priceValue <= 0) {
            showMessage('Lütfen geçerli bir ürün adı ve pozitif fiyat girin.', 'error');
            return;
        }
        
        const productData = {
            name: product.name,
            price: priceValue // Sayıyı gönder
        };
        
        if (isEditing && initialData) {
            // Düzenleme modu: PUT işlemi
            if (onUpdate) {
                onUpdate(initialData.id, productData);
            }
        } else {
            // Ekleme modu: POST işlemi
            onSave(productData);
            setProduct({ name: '', price: '' }); // Formu sıfırla
        }
    };

    const title = isEditing ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle';
    const icon = isEditing ? <Edit2 className="w-5 h-5 text-indigo-500 mr-2" /> : <PlusCircle className="w-5 h-5 text-green-500 mr-2" />;
    const buttonText = isEditing ? 'Güncelle' : 'Ekle';
    const buttonBg = isEditing ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-green-600 hover:bg-green-700';

    return (
        <div className={`bg-white p-6 rounded-xl shadow-lg border-l-4 ${isEditing ? 'border-indigo-500' : 'border-green-500'} mb-8`}>
            <h3 className="flex items-center text-xl font-semibold mb-4 text-gray-800">
                {icon}
                {title}
            </h3>
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
                <input
                    type="text"
                    name="name"
                    placeholder="Ürün Adı"
                    value={product.name}
                    onChange={handleChange}
                    required
                    className="flex-grow shadow-sm border border-gray-300 rounded-lg py-2.5 px-3 text-gray-700 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition"
                />
                <input
                    type="text" // Type'ı number yerine text bıraktım, daha iyi kontrol için
                    name="price"
                    placeholder="Fiyat (Örn: 99.99)"
                    value={product.price}
                    onChange={handleChange}
                    required
                    className="flex-grow shadow-sm border border-gray-300 rounded-lg py-2.5 px-3 text-gray-700 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition w-32 md:w-auto"
                />
                
                <div className='flex gap-2'>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`${buttonBg} text-white font-semibold py-2.5 px-6 rounded-lg transition disabled:opacity-50 shadow-md flex items-center justify-center`}
                    >
                        {isLoading ? <LoadingSpinner message="" color="bg-white" /> : buttonText}
                    </button>
                    
                    {isEditing && onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2.5 px-6 rounded-lg transition shadow-md flex items-center justify-center"
                        >
                            <XCircle className="w-5 h-5 mr-1" /> İptal
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
  };
  
  // ProductList Bileşeni (Düzenle Butonu Eklendi)
  interface ProductListProps {
      products: Product[];
      onDeleteProduct: (id: number) => Promise<void>;
      onEditProduct: (product: Product) => void; // Yeni prop
  }

  const ProductList: React.FC<ProductListProps> = ({ products, onDeleteProduct, onEditProduct }) => {
    if (isLoading) {
        return <div className="flex justify-center items-center h-48 bg-white rounded-xl shadow-lg"><LoadingSpinner message="Ürünler yükleniyor..." /></div>;
    }
    
    if (products.length === 0) {
        return <p className="text-center text-gray-500 p-8 bg-white rounded-xl shadow-lg border-t-4 border-gray-300">Henüz hiç ürün eklenmedi. İlk ürünü ekleyin!</p>;
    }
    
    return (
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border-t-8 border-indigo-600">
            <h3 className="flex items-center text-2xl font-bold text-gray-800 p-6 bg-indigo-50 border-b border-indigo-200">
                <Package className="w-6 h-6 text-indigo-600 mr-3" />
                Mevcut Ürünler
            </h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ürün Adı</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fiyat</th>
                            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {products.map((product) => {
                            const priceValue = parseFloat(String(product.price));
                            
                            const displayPrice = !isNaN(priceValue) && priceValue >= 0
                                ? priceValue.toFixed(2)
                                : '0.00';

                            return (
                                <tr key={product.id} className="hover:bg-indigo-50/50 transition duration-150">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{product.id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{product.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-700 font-bold font-mono">{displayPrice} TL</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                        <div className="flex justify-center space-x-2">
                                            {/* YENİ: Düzenle Butonu */}
                                            <button
                                                onClick={() => onEditProduct(product)}
                                                className="text-indigo-600 hover:text-indigo-800 transition p-2 rounded-full hover:bg-indigo-100/70"
                                                title="Ürünü Düzenle"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            
                                            <button
                                                onClick={() => onDeleteProduct(product.id)}
                                                className="text-red-600 hover:text-red-800 transition p-2 rounded-full hover:bg-red-100/70"
                                                title="Ürünü Sil"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };
  
  // Dashboard Bileşeni (Formun Dinamik Hale Getirilmesi ve Yeni Navbar)
  const Dashboard: React.FC = () => (
    <div className="p-4 sm:p-8 min-h-screen bg-gray-100 font-sans">
        {/* Header - YENİ: Navigasyon butonları eklendi */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 bg-white p-6 rounded-xl shadow-xl sticky top-0 z-10 border-b-4 border-indigo-500">
            <div className="flex items-center mb-4 md:mb-0">
                <Package className="w-8 h-8 mr-3 text-indigo-600" />
                <div>
                    <h1 className="text-3xl font-extrabold text-indigo-800">Ürün Yönetim Paneli</h1>
                    <p className="text-gray-600 text-sm">Hoş Geldiniz, <strong className="font-extrabold text-indigo-600">{username}</strong></p>
                </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-3 md:space-y-0 md:space-x-4 w-full md:w-auto">
                {/* Navigasyon Butonları */}
                <div className="flex space-x-2">
                    <button
                        onClick={() => setView('dashboard')}
                        className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg transition shadow-md flex items-center space-x-1"
                    >
                        <Package className="w-5 h-5" />
                        <span>Ürünler</span>
                    </button>
                    <button
                        onClick={() => setView('analysis')}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition shadow-md flex items-center space-x-1"
                    >
                        <Github className="w-5 h-5" />
                        <span>Repo Analiz</span>
                    </button>
                </div>
                
                <button
                    onClick={handleLogout}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition shadow-md flex items-center space-x-1"
                    title="Çıkış Yap"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Çıkış Yap</span>
                </button>
            </div>
        </header>

        {/* Content */}
        <div className='max-w-7xl mx-auto'>
            
            {/* Form Alanı: Düzenleme modundaysa Düzenleme Formu, değilse Ekleme Formu gösterilir. */}
            {editingProduct ? (
                <ProductForm 
                    onSave={handleAddProduct} // Kullanılmayacak ama required
                    onUpdate={handleUpdateProduct} // Güncelleme işlemi
                    initialData={editingProduct}
                    onCancel={cancelEdit} // İptal işlemi
                />
            ) : (
                <ProductForm 
                    onSave={handleAddProduct} // Ekleme işlemi
                    initialData={null}
                />
            )}
            
            {/* Liste Alanı */}
            <ProductList 
                products={products} 
                onDeleteProduct={handleDeleteProduct} 
                onEditProduct={startEdit} // Düzenleme butonuna basıldığında
            />
        </div>
    </div>
  );


  // ------------------------------------------------------------------
  // ANA RENDER (Güncellendi - analysis view eklendi)
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
