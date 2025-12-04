import React, { useState, useEffect } from 'react';
import { Github, Search, FileText, AlertCircle, CheckCircle, XCircle, Loader } from 'lucide-react';

interface Analysis {
  id: number;
  githubUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  sbomData?: any;
  licenseReport?: any;
  errorMessage?: string;
  createdAt: string;
}

interface AnalysisPageProps {
  token: string | null;
  username: string;
  onLogout: () => void;
  showMessage: (text: string, type: 'success' | 'error') => void;
}

const AnalysisPage: React.FC<AnalysisPageProps> = ({ token, username, onLogout, showMessage }) => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [githubUrl, setGithubUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://backend-nest-msnd.onrender.com';

  const fetchAnalyses = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/analysis`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setAnalyses(data);
      }
    } catch (error) {
      showMessage('Analizler yüklenirken hata oluştu.', 'error');
    }
  };

  const handleSubmitAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !githubUrl.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/analysis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ githubUrl: githubUrl.trim() }),
      });

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (response.ok) {
        const newAnalysis = await response.json();
        setAnalyses(prev => [newAnalysis, ...prev]);
        setGithubUrl('');
        showMessage('Analiz başlatıldı! Sonuçlar kısa süre içinde hazır olacak.', 'success');
        
        // 5 saniye sonra analizleri yenile
        setTimeout(fetchAnalyses, 5000);
      } else {
        const error = await response.json();
        showMessage(error.message || 'Analiz başlatılamadı.', 'error');
      }
    } catch (error) {
      showMessage('Sunucuya bağlanılamadı.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAnalyses();
      // Her 10 saniyede bir analiz durumlarını güncelle
      const interval = setInterval(fetchAnalyses, 10000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const getStatusIcon = (status: Analysis['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing': return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusText = (status: Analysis['status']) => {
    switch (status) {
      case 'completed': return 'Tamamlandı';
      case 'processing': return 'İşleniyor';
      case 'failed': return 'Başarısız';
      default: return 'Beklemede';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR');
  };

  return (
    <div className="p-4 sm:p-8 min-h-screen bg-gray-100 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center mb-10 bg-white p-6 rounded-xl shadow-xl sticky top-0 z-10 border-b-4 border-indigo-500">
        <div className="flex items-center">
          <Github className="w-8 h-8 mr-3 text-indigo-600" />
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-800">GitHub Repo Analiz</h1>
            <p className="text-gray-600 text-sm">OSS Lisans Uyumluluk Kontrolü</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-gray-600 text-sm hidden sm:inline">
            Hoş Geldiniz, <strong className="font-extrabold text-indigo-600">{username}</strong>
          </span>
          <button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition shadow-md flex items-center space-x-1"
            title="Çıkış Yap"
          >
            <XCircle className="w-5 h-5" />
            <span className="hidden md:inline">Çıkış Yap</span>
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Analiz Formu */}
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-indigo-500">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <Search className="w-6 h-6 mr-2 text-indigo-500" />
            Yeni Repo Analizi
          </h2>
          <form onSubmit={handleSubmitAnalysis} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                GitHub Repository URL
              </label>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/kullanici/repo"
                required
                className="w-full py-3 px-4 border border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:ring-4 focus:ring-indigo-200 focus:border-indigo-500 transition duration-300"
              />
              <p className="mt-2 text-sm text-gray-500">
                Örnek: https://github.com/facebook/react veya https://github.com/vuejs/vue.git
              </p>
            </div>
            <button
              type="submit"
              disabled={isLoading || !token}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition duration-300 shadow-lg hover:shadow-xl disabled:bg-indigo-400 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Analiz Başlatılıyor...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Analiz Başlat
                </>
              )}
            </button>
          </form>
        </div>

        {/* Analiz Listesi */}
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          <h3 className="flex items-center text-2xl font-bold text-gray-800 p-6 bg-indigo-50 border-b border-indigo-200">
            <FileText className="w-6 h-6 text-indigo-600 mr-3" />
            Analiz Geçmişi
          </h3>
          
          {analyses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Github className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Henüz analiz yapılmadı.</p>
              <p className="text-sm mt-2">Yukarıdaki form ile bir GitHub repository analizi başlatın.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Repository</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Durum</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tarih</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">İşlem</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {analyses.map((analysis) => (
                    <tr key={analysis.id} className="hover:bg-indigo-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {analysis.githubUrl}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {getStatusIcon(analysis.status)}
                          <span className="ml-2 text-sm">{getStatusText(analysis.status)}</span>
                        </div>
                        {analysis.errorMessage && (
                          <div className="text-xs text-red-500 mt-1">{analysis.errorMessage}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(analysis.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedAnalysis(analysis)}
                          disabled={analysis.status !== 'completed'}
                          className={`px-4 py-2 rounded-lg text-sm font-medium ${
                            analysis.status === 'completed'
                              ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          Detayları Gör
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Analiz Detay Modal */}
      {selectedAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-gray-800">Analiz Detayları</h3>
                <button
                  onClick={() => setSelectedAnalysis(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <p className="text-gray-600 mt-2">{selectedAnalysis.githubUrl}</p>
            </div>
            
            <div className="p-6 space-y-6">
              {selectedAnalysis.licenseReport ? (
                <>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-bold text-green-800 mb-2">Lisans Analiz Sonucu</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg shadow">
                        <div className="text-2xl font-bold text-green-600">
                          {selectedAnalysis.licenseReport.summary?.compliant || 0}
                        </div>
                        <div className="text-sm text-gray-600">Uyumlu</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow">
                        <div className="text-2xl font-bold text-red-600">
                          {selectedAnalysis.licenseReport.summary?.nonCompliant || 0}
                        </div>
                        <div className="text-sm text-gray-600">Yasaklı</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow">
                        <div className="text-2xl font-bold text-yellow-600">
                          {selectedAnalysis.licenseReport.summary?.needsReview || 0}
                        </div>
                        <div className="text-sm text-gray-600">İnceleme Gerekli</div>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg shadow">
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedAnalysis.licenseReport.summary?.total || 0}
                        </div>
                        <div className="text-sm text-gray-600">Toplam Paket</div>
                      </div>
                    </div>
                  </div>

                  {selectedAnalysis.sbomData && (
                    <div>
                      <h4 className="font-bold text-gray-800 mb-3">Proje Bilgileri</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <pre className="text-sm whitespace-pre-wrap">
                          {JSON.stringify(selectedAnalysis.sbomData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Analiz sonuçları henüz hazır değil veya bir hata oluştu.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisPage;
