import React, { useState, useEffect } from 'react';
import { 
  Github, 
  Search, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Loader, 
  Shield, 
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Calendar,
  Package,
  AlertTriangle,
  Info,
  ChevronRight,
  Clock,
  BarChart3,
  Copy,
  Check
} from 'lucide-react';

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
  onAnalysisCreated?: () => void;
}

const AnalysisPage: React.FC<AnalysisPageProps> = ({ 
  token, 
  username, 
  onLogout, 
  showMessage,
  onAnalysisCreated 
}) => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [githubUrl, setGithubUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'sbom' | 'licenses'>('summary');
  const [copied, setCopied] = useState(false);

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
    if (!token || !githubUrl.trim()) {
      showMessage('Lütfen geçerli bir GitHub URL\'si girin.', 'error');
      return;
    }

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
        
        if (onAnalysisCreated) {
          onAnalysisCreated();
        }
        
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
      case 'completed': return <ShieldCheck className="w-5 h-5 text-green-500" />;
      case 'processing': return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: Analysis['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'failed': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
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
    return new Date(dateString).toLocaleString('tr-TR', {
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
      const parts = urlObj.pathname.split('/').filter(p => p);
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
      return url;
    } catch {
      return url;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLicenseReason = (license: string) => {
    const lowerLicense = license.toLowerCase();
    
    if (lowerLicense.includes('gpl')) {
      if (lowerLicense.includes('agpl')) {
        return 'AGPL lisansı türev çalışmaların da aynı lisansla açık kaynak olmasını zorunlu kılar';
      } else if (lowerLicense.includes('gpl-3')) {
        return 'GPL-3.0 lisansı türev çalışmaların kaynak kodunun açılmasını gerektirir';
      } else if (lowerLicense.includes('gpl-2')) {
        return 'GPL-2.0 lisansı türev çalışmaların kaynak kodunun açılmasını gerektirir';
      }
      return 'GPL lisansları ticari kullanımda kısıtlamalar getirir';
    }
    
    if (lowerLicense.includes('lgpl')) {
      return 'LGPL lisansı dinamik linklemede daha esnektir, ancak yine de inceleme gerekir';
    }
    
    if (lowerLicense.includes('mpl')) {
      return 'MPL lisansı dosya bazında değişikliklerin açılmasını gerektirir';
    }
    
    return 'Bu lisans türü şirket politikalarına göre değerlendirilmelidir';
  };

  // Analiz Kartı Bileşeni
  const AnalysisCard: React.FC<{ analysis: Analysis }> = ({ analysis }) => {
    const stats = analysis.licenseReport?.summary || { 
      total: 0, 
      compliant: 0, 
      nonCompliant: 0, 
      needsReview: 0 
    };

    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-5 hover:shadow-xl transition-shadow duration-300">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <Github className="w-5 h-5" />
              {getRepoName(analysis.githubUrl)}
            </h3>
            <p className="text-sm text-gray-600 mt-1 truncate max-w-md">{analysis.githubUrl}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 border ${getStatusColor(analysis.status)}`}>
            {getStatusIcon(analysis.status)}
            {getStatusText(analysis.status)}
          </div>
        </div>

        {analysis.status === 'completed' && stats.total > 0 && (
          <div className="mb-4">
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="bg-green-50 p-2 rounded-lg text-center">
                <div className="text-xl font-bold text-green-700">{stats.compliant}</div>
                <div className="text-xs text-green-600">Uyumlu</div>
              </div>
              <div className="bg-red-50 p-2 rounded-lg text-center">
                <div className="text-xl font-bold text-red-700">{stats.nonCompliant}</div>
                <div className="text-xs text-red-600">Yasaklı</div>
              </div>
              <div className="bg-yellow-50 p-2 rounded-lg text-center">
                <div className="text-xl font-bold text-yellow-700">{stats.needsReview}</div>
                <div className="text-xs text-yellow-600">İnceleme</div>
              </div>
              <div className="bg-blue-50 p-2 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-700">{stats.total}</div>
                <div className="text-xs text-blue-600">Toplam</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {formatDate(analysis.createdAt)}
          </span>
          <button
            onClick={() => setSelectedAnalysis(analysis)}
            disabled={analysis.status !== 'completed'}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 ${
              analysis.status === 'completed'
                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Detaylar
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 font-sans">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 bg-white p-6 rounded-2xl shadow-2xl sticky top-0 z-10 border-l-8 border-blue-600">
        <div className="flex items-center mb-4 md:mb-0">
          <div className="p-3 bg-blue-100 rounded-xl mr-4">
            <Shield className="w-10 h-10 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-blue-800">GitHub Repo Analiz</h1>
            <p className="text-gray-600">
              Hoş Geldiniz, <strong className="font-extrabold text-blue-600">{username}</strong>
            </p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-3 md:space-y-0 md:space-x-4 w-full md:w-auto">
          <button
            onClick={() => window.history.back()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-5 rounded-xl transition shadow-md flex items-center space-x-2"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
            <span>Geri Dön</span>
          </button>
          
          <button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-5 rounded-xl transition shadow-md flex items-center space-x-2"
            title="Çıkış Yap"
          >
            <XCircle className="w-5 h-5" />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Analiz Formu */}
        <div className="bg-white p-8 rounded-2xl shadow-2xl border-t-8 border-blue-500">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-blue-100 rounded-xl mr-4">
              <Search className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Yeni Repo Analizi</h2>
              <p className="text-gray-600">GitHub repository'lerinin lisans uyumluluğunu kontrol edin</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmitAnalysis} className="space-y-6">
            <div>
              <label className="block text-gray-700 text-lg font-semibold mb-3">
                GitHub Repository URL
              </label>
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/kullanici/repository"
                  required
                  className="flex-grow py-3.5 px-5 border-2 border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:ring-4 focus:ring-blue-200 focus:border-blue-500 transition duration-300 text-lg"
                />
                <button
                  type="submit"
                  disabled={isLoading || !token}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 px-8 rounded-xl transition duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center min-w-[180px]"
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
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Info className="w-4 h-4" />
                  Örnek URL'ler:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setGithubUrl('https://github.com/facebook/react')}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg"
                  >
                    facebook/react
                  </button>
                  <button
                    type="button"
                    onClick={() => setGithubUrl('https://github.com/expressjs/express')}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg"
                  >
                    expressjs/express
                  </button>
                  <button
                    type="button"
                    onClick={() => setGithubUrl('https://github.com/nodejs/node')}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg"
                  >
                    nodejs/node
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Analiz Geçmişi */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div className="flex items-center mb-4 md:mb-0">
                <div className="p-2 bg-white rounded-lg mr-3">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Analiz Geçmişi</h3>
                  <p className="text-gray-600">Tamamlanan ve devam eden analizleriniz</p>
                </div>
              </div>
              <button
                onClick={fetchAnalyses}
                disabled={isLoading}
                className="bg-white hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-5 rounded-xl transition shadow-md flex items-center gap-2 border border-gray-300"
              >
                {isLoading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : null}
                Yenile
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {analyses.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Github className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Henüz analiz yapılmadı</h3>
                <p className="text-gray-500 mb-6">İlk analizinizi yapmak için yukarıdaki formu kullanın</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {analyses.slice(0, 8).map((analysis) => (
                  <AnalysisCard key={analysis.id} analysis={analysis} />
                ))}
              </div>
            )}

            {analyses.length > 8 && (
              <div className="mt-8 text-center">
                <button className="text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-2 mx-auto">
                  Tüm analiz geçmişini görüntüle ({analyses.length} analiz)
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analiz Detay Modal */}
      {selectedAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg">
                      <Github className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800">Analiz Detayları</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-gray-600 break-all">{selectedAnalysis.githubUrl}</p>
                    <button
                      onClick={() => copyToClipboard(selectedAnalysis.githubUrl)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      title="URL'yi kopyala"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAnalysis(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 ml-4"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex space-x-1 mt-6">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    activeTab === 'summary' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 inline mr-2" />
                  Özet
                </button>
                <button
                  onClick={() => setActiveTab('licenses')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    activeTab === 'licenses' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Shield className="w-4 h-4 inline mr-2" />
                  Lisanslar
                </button>
                <button
                  onClick={() => setActiveTab('sbom')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    activeTab === 'sbom' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Package className="w-4 h-4 inline mr-2" />
                  SBOM
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'summary' && selectedAnalysis.licenseReport && (
                <div className="space-y-6">
                  {/* Özet Kartları */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl border border-green-200">
                      <div className="flex items-center justify-between mb-3">
                        <ShieldCheck className="w-8 h-8 text-green-600" />
                        <span className="text-3xl font-bold text-green-700">
                          {selectedAnalysis.licenseReport.summary?.compliant || 0}
                        </span>
                      </div>
                      <div className="text-green-800 font-semibold">Uyumlu Lisans</div>
                      <div className="text-sm text-green-600 mt-1">MIT, Apache, BSD vb.</div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-red-50 to-red-100 p-5 rounded-xl border border-red-200">
                      <div className="flex items-center justify-between mb-3">
                        <ShieldAlert className="w-8 h-8 text-red-600" />
                        <span className="text-3xl font-bold text-red-700">
                          {selectedAnalysis.licenseReport.summary?.nonCompliant || 0}
                        </span>
                      </div>
                      <div className="text-red-800 font-semibold">Yasaklı Lisans</div>
                      <div className="text-sm text-red-600 mt-1">GPL, AGPL vb.</div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-5 rounded-xl border border-yellow-200">
                      <div className="flex items-center justify-between mb-3">
                        <AlertCircle className="w-8 h-8 text-yellow-600" />
                        <span className="text-3xl font-bold text-yellow-700">
                          {selectedAnalysis.licenseReport.summary?.needsReview || 0}
                        </span>
                      </div>
                      <div className="text-yellow-800 font-semibold">İnceleme Gerekli</div>
                      <div className="text-sm text-yellow-600 mt-1">LGPL, MPL vb.</div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <Package className="w-8 h-8 text-blue-600" />
                        <span className="text-3xl font-bold text-blue-700">
                          {selectedAnalysis.licenseReport.summary?.total || 0}
                        </span>
                      </div>
                      <div className="text-blue-800 font-semibold">Toplam Paket</div>
                      <div className="text-sm text-blue-600 mt-1">Tüm bağımlılıklar</div>
                    </div>
                  </div>

                  {/* Proje Lisansı */}
                  {selectedAnalysis.licenseReport.projectLicense && (
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-5 rounded-xl border border-gray-300">
                      <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Proje Ana Lisansı
                      </h4>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-2xl font-bold text-gray-800">
                            {selectedAnalysis.licenseReport.projectLicense}
                          </span>
                          <div className={`inline-flex items-center ml-3 px-3 py-1 rounded-full text-sm ${
                            selectedAnalysis.licenseReport.projectLicenseCompliant
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {selectedAnalysis.licenseReport.projectLicenseCompliant ? 'Uyumlu' : 'Uyumsuz'}
                          </div>
                        </div>
                        {!selectedAnalysis.licenseReport.projectLicenseCompliant && (
                          <AlertTriangle className="w-8 h-8 text-red-500" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Öneriler */}
                  <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-5 rounded-xl border border-blue-300">
                    <h4 className="font-bold text-gray-800 mb-3">Öneriler</h4>
                    <ul className="space-y-2">
                      {selectedAnalysis.licenseReport.summary?.nonCompliant > 0 && (
                        <li className="flex items-start gap-2">
                          <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>{selectedAnalysis.licenseReport.summary.nonCompliant} yasaklı lisans</strong> tespit edildi. 
                            Bu paketleri alternatifleriyle değiştirmeniz önerilir.
                          </span>
                        </li>
                      )}
                      {selectedAnalysis.licenseReport.summary?.needsReview > 0 && (
                        <li className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>{selectedAnalysis.licenseReport.summary.needsReview} paket</strong> yasal inceleme gerektiriyor. 
                            Hukuk departmanınızla görüşmeniz önerilir.
                          </span>
                        </li>
                      )}
                      {selectedAnalysis.licenseReport.summary?.compliant === selectedAnalysis.licenseReport.summary?.total && (
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>Tebrikler!</strong> Tüm paketler uyumlu lisanslara sahip. Proje güvenle kullanılabilir.
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'licenses' && selectedAnalysis.licenseReport && (
                <div className="space-y-6">
                  {/* Yasaklı Lisanslar */}
                  {selectedAnalysis.licenseReport.banned && selectedAnalysis.licenseReport.banned.length > 0 && (
                    <div>
                      <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-red-700">
                        <ShieldAlert className="w-5 h-5" />
                        Yasaklı Lisanslar ({selectedAnalysis.licenseReport.banned.length})
                      </h4>
                      <div className="space-y-3">
                        {selectedAnalysis.licenseReport.banned.slice(0, 10).map((pkg: any, index: number) => (
                          <div key={index} className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-bold text-red-800">{pkg.package}@{pkg.version}</div>
                                <div className="text-red-600 mt-1">{pkg.license}</div>
                                <div className="text-sm text-red-500 mt-2">
                                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                                  {getLicenseReason(pkg.license)}
                                </div>
                              </div>
                              <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full">
                                YASAKLI
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* İnceleme Gerekenler */}
                  {selectedAnalysis.licenseReport.needsReview && selectedAnalysis.licenseReport.needsReview.length > 0 && (
                    <div>
                      <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-yellow-700">
                        <AlertCircle className="w-5 h-5" />
                        İnceleme Gerekenler ({selectedAnalysis.licenseReport.needsReview.length})
                      </h4>
                      <div className="space-y-3">
                        {selectedAnalysis.licenseReport.needsReview.slice(0, 10).map((pkg: any, index: number) => (
                          <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-bold text-yellow-800">{pkg.package}@{pkg.version}</div>
                                <div className="text-yellow-600 mt-1">{pkg.license}</div>
                                <div className="text-sm text-yellow-500 mt-2">
                                  <Info className="w-4 h-4 inline mr-1" />
                                  {getLicenseReason(pkg.license)}
                                </div>
                              </div>
                              <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full">
                                İNCELE
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Uyumlu Lisanslar */}
                  {selectedAnalysis.licenseReport.allowed && selectedAnalysis.licenseReport.allowed.length > 0 && (
                    <div>
                      <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-green-700">
                        <ShieldCheck className="w-5 h-5" />
                        Uyumlu Lisanslar ({selectedAnalysis.licenseReport.allowed.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedAnalysis.licenseReport.allowed.slice(0, 20).map((pkg: any, index: number) => (
                          <div key={index} className="bg-green-50 border border-green-200 rounded-xl p-3">
                            <div className="font-bold text-green-800 truncate">{pkg.package}</div>
                            <div className="text-sm text-green-600">v{pkg.version}</div>
                            <div className="text-xs text-green-500 mt-1">{pkg.license}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'sbom' && selectedAnalysis.sbomData && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-gray-800 mb-4">Proje Bilgileri</h4>
                    <div className="bg-gray-50 rounded-xl p-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">Proje Adı</div>
                          <div className="font-bold text-gray-800 text-lg">
                            {selectedAnalysis.sbomData.projectName || 'Belirtilmemiş'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Versiyon</div>
                          <div className="font-bold text-gray-800 text-lg">
                            {selectedAnalysis.sbomData.version || 'Belirtilmemiş'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Lisans</div>
                          <div className="font-bold text-gray-800 text-lg">
                            {selectedAnalysis.sbomData.license || 'Belirtilmemiş'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Bulunduğu Yer</div>
                          <div className="font-bold text-gray-800 text-lg">
                            {selectedAnalysis.sbomData.foundAt || 'Belirtilmemiş'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bağımlılıklar */}
                  {selectedAnalysis.sbomData.dependencies && Object.keys(selectedAnalysis.sbomData.dependencies).length > 0 && (
                    <div>
                      <h4 className="font-bold text-gray-800 mb-4">Bağımlılıklar ({Object.keys(selectedAnalysis.sbomData.dependencies).length})</h4>
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="max-h-60 overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Paket</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Versiyon</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {Object.entries(selectedAnalysis.sbomData.dependencies).map(([name, version]: [string, any]) => (
                                <tr key={name} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{name}</td>
                                  <td className="px-4 py-3 text-sm text-gray-500">{version}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* JSON View */}
                  <div>
                    <h4 className="font-bold text-gray-800 mb-4">Ham SBOM Verisi</h4>
                    <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                      <pre className="text-gray-100 text-sm">
                        {JSON.stringify(selectedAnalysis.sbomData, null, 2)}
                      </pre>
                    </div>
                  </div>
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