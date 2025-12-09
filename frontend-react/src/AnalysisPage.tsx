import React, { useState, useEffect } from 'react';
import { Github, Search, FileText, AlertCircle, CheckCircle, XCircle, Loader, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface Analysis {
  id: number;
  githubUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  sbomData?: any;
  licenseReport?: LicenseReport;
  errorMessage?: string;
  createdAt: string;
}

interface LicenseReport {
  allowed: LicenseItem[];
  banned: LicenseItem[];
  needsReview: LicenseItem[];
  unknown: LicenseItem[];
  summary: {
    total: number;
    compliant: number;
    nonCompliant: number;
    needsReview: number;
  };
  projectLicense?: string;
  projectLicenseCompliant?: boolean;
  error?: string;
  warning?: string;
}

interface LicenseItem {
  package: string;
  version: string;
  license: string;
  repository?: string;
  publisher?: string;
  email?: string;
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
  const [expandedLicenseTypes, setExpandedLicenseTypes] = useState<{
    allowed: boolean;
    banned: boolean;
    needsReview: boolean;
    unknown: boolean;
  }>({
    allowed: false,
    banned: true,
    needsReview: true,
    unknown: false
  });
  const [searchTerm, setSearchTerm] = useState('');

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

  const toggleLicenseType = (type: keyof typeof expandedLicenseTypes) => {
    setExpandedLicenseTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const getFilteredLicenses = (licenses: LicenseItem[]) => {
    if (!searchTerm.trim()) return licenses;
    
    const term = searchTerm.toLowerCase();
    return licenses.filter(item => 
      item.package.toLowerCase().includes(term) ||
      item.license.toLowerCase().includes(term) ||
      item.version.toLowerCase().includes(term)
    );
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#10b981',
        borderRadius: '20px',
        padding: '30px',
        marginBottom: '30px',
        border: '4px solid #059669',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              backgroundColor: '#059669',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Github size={30} color="white" />
            </div>
            <div>
              <h1 style={{
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold',
                marginBottom: '5px'
              }}>
                GİTHUB REPO ANALİZ
              </h1>
              <p style={{ color: '#a7f3d0', fontSize: '16px' }}>
                OSS Lisans Uyumluluk Kontrolü - Hoş geldin, <strong>{username}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <XCircle size={20} />
            ÇIKIŞ YAP
          </button>
        </div>
      </div>

      {/* Analiz Formu */}
      <div style={{
        backgroundColor: '#d1fae5',
        borderRadius: '20px',
        padding: '30px',
        marginBottom: '30px',
        border: '4px solid #10b981'
      }}>
        <h2 style={{
          color: '#065f46',
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Search size={24} color="#065f46" />
          YENİ REPO ANALİZİ
        </h2>
        
        <form onSubmit={handleSubmitAnalysis}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#065f46',
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '10px'
            }}>
              GitHub Repository URL
            </label>
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/kullanici/repo"
              required
              style={{
                width: '100%',
                padding: '15px',
                borderRadius: '10px',
                border: '2px solid #10b981',
                fontSize: '16px',
                outline: 'none',
                backgroundColor: 'white'
              }}
            />
            <p style={{
              marginTop: '10px',
              color: '#6b7280',
              fontSize: '14px'
            }}>
              Örnek: https://github.com/facebook/react veya https://github.com/vuejs/vue.git
            </p>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !token}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: (isLoading || !token) ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {isLoading ? (
              <>
                <Loader size={20} className="animate-spin" />
                ANALİZ BAŞLATILIYOR...
              </>
            ) : (
              <>
                <Search size={20} />
                ANALİZ BAŞLAT
              </>
            )}
          </button>
        </form>
      </div>

      {/* Analiz Listesi */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        overflow: 'hidden',
        border: '4px solid #10b981',
        boxShadow: '0 20px 60px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          backgroundColor: '#d1fae5',
          padding: '20px',
          borderBottom: '2px solid #10b981'
        }}>
          <h3 style={{
            color: '#065f46',
            fontSize: '24px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <FileText size={24} />
            ANALİZ GEÇMİŞİ
          </h3>
        </div>
        
        {analyses.length === 0 ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            <Github size={80} color="#9ca3af" style={{ marginBottom: '20px' }} />
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>Henüz analiz yapılmadı.</p>
            <p style={{ fontSize: '14px' }}>Yukarıdaki form ile bir GitHub repository analizi başlatın.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{
                  backgroundColor: '#f3f4f6'
                }}>
                  <th style={{
                    padding: '16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '14px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    Repository
                  </th>
                  <th style={{
                    padding: '16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '14px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    Durum
                  </th>
                  <th style={{
                    padding: '16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '14px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    Tarih
                  </th>
                  <th style={{
                    padding: '16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '14px',
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((analysis) => (
                  <tr key={analysis.id} style={{
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: 'white'
                  }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#111827',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {analysis.githubUrl}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getStatusIcon(analysis.status)}
                        <span style={{ fontSize: '14px' }}>{getStatusText(analysis.status)}</span>
                      </div>
                      {analysis.errorMessage && (
                        <div style={{
                          fontSize: '12px',
                          color: '#dc2626',
                          marginTop: '4px'
                        }}>
                          {analysis.errorMessage}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>
                        {formatDate(analysis.createdAt)}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <button
                        onClick={() => setSelectedAnalysis(analysis)}
                        disabled={analysis.status !== 'completed'}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          border: 'none',
                          cursor: analysis.status === 'completed' ? 'pointer' : 'not-allowed',
                          backgroundColor: analysis.status === 'completed' ? '#dbeafe' : '#f3f4f6',
                          color: analysis.status === 'completed' ? '#1e40af' : '#9ca3af'
                        }}
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

      {/* Analiz Detay Modal */}
      {selectedAnalysis && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            maxWidth: '1200px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '4px solid #10b981'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '2px solid #e5e7eb',
              backgroundColor: '#d1fae5'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#065f46'
                }}>
                  Analiz Detayları
                </h3>
                <button
                  onClick={() => setSelectedAnalysis(null)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  <XCircle size={24} />
                </button>
              </div>
              <p style={{
                marginTop: '8px',
                color: '#065f46'
              }}>
                {selectedAnalysis.githubUrl}
              </p>
            </div>
            
            <div style={{ padding: '24px' }}>
              {selectedAnalysis.licenseReport ? (
                <>
                  {/* Özet Kartları */}
                  <div style={{
                    backgroundColor: '#d1fae5',
                    padding: '24px',
                    borderRadius: '12px',
                    border: '2px solid #10b981',
                    marginBottom: '24px'
                  }}>
                    <h4 style={{
                      fontWeight: 'bold',
                      color: '#065f46',
                      fontSize: '20px',
                      marginBottom: '16px'
                    }}>
                      Lisans Analiz Sonucu
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '16px'
                    }}>
                      <div style={{
                        textAlign: 'center',
                        padding: '16px',
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        border: '2px solid #10b981'
                      }}>
                        <div style={{
                          fontSize: '32px',
                          fontWeight: 'bold',
                          color: '#10b981',
                          marginBottom: '8px'
                        }}>
                          {selectedAnalysis.licenseReport.summary?.compliant || 0}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#6b7280'
                        }}>
                          Uyumlu
                        </div>
                      </div>
                      
                      <div style={{
                        textAlign: 'center',
                        padding: '16px',
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        border: '2px solid #ef4444'
                      }}>
                        <div style={{
                          fontSize: '32px',
                          fontWeight: 'bold',
                          color: '#ef4444',
                          marginBottom: '8px'
                        }}>
                          {selectedAnalysis.licenseReport.summary?.nonCompliant || 0}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#6b7280'
                        }}>
                          Yasaklı
                        </div>
                      </div>
                      
                      <div style={{
                        textAlign: 'center',
                        padding: '16px',
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        border: '2px solid #f59e0b'
                      }}>
                        <div style={{
                          fontSize: '32px',
                          fontWeight: 'bold',
                          color: '#f59e0b',
                          marginBottom: '8px'
                        }}>
                          {selectedAnalysis.licenseReport.summary?.needsReview || 0}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#6b7280'
                        }}>
                          İnceleme Gerekli
                        </div>
                      </div>
                      
                      <div style={{
                        textAlign: 'center',
                        padding: '16px',
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        border: '2px solid #3b82f6'
                      }}>
                        <div style={{
                          fontSize: '32px',
                          fontWeight: 'bold',
                          color: '#3b82f6',
                          marginBottom: '8px'
                        }}>
                          {selectedAnalysis.licenseReport.summary?.total || 0}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#6b7280'
                        }}>
                          Toplam Paket
                        </div>
                      </div>
                    </div>

                    {/* Proje Lisansı */}
                    {selectedAnalysis.licenseReport.projectLicense && (
                      <div style={{
                        marginTop: '20px',
                        padding: '16px',
                        backgroundColor: 'white',
                        borderRadius: '10px',
                        border: '2px solid',
                        borderColor: selectedAnalysis.licenseReport.projectLicenseCompliant ? '#10b981' : '#ef4444'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginBottom: '8px'
                        }}>
                          {selectedAnalysis.licenseReport.projectLicenseCompliant ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          )}
                          <span style={{
                            fontWeight: 'bold',
                            color: '#111827'
                          }}>
                            Proje Lisansı: {selectedAnalysis.licenseReport.projectLicense}
                          </span>
                        </div>
                        <p style={{
                          color: '#6b7280',
                          fontSize: '14px',
                          marginLeft: '30px'
                        }}>
                          {selectedAnalysis.licenseReport.projectLicenseCompliant 
                            ? '✓ Bu lisans açık kaynak kullanımı için uyumludur.' 
                            : '⚠ Bu lisans açık kaynak kullanımı için uyumlu olmayabilir.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Lisans Detayları */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}>
                      <h4 style={{
                        fontWeight: 'bold',
                        color: '#1f2937',
                        fontSize: '20px'
                      }}>
                        Paket Lisans Detayları
                      </h4>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <input
                          type="text"
                          placeholder="Paket veya lisans ara..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '2px solid #e5e7eb',
                            fontSize: '14px',
                            width: '200px'
                          }}
                        />
                      </div>
                    </div>

                    {/* Uyumlu Lisanslar */}
                    {selectedAnalysis.licenseReport.allowed && selectedAnalysis.licenseReport.allowed.length > 0 && (
                      <div style={{
                        marginBottom: '16px',
                        border: '2px solid #10b981',
                        borderRadius: '12px',
                        overflow: 'hidden'
                      }}>
                        <div
                          onClick={() => toggleLicenseType('allowed')}
                          style={{
                            backgroundColor: '#d1fae5',
                            padding: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <CheckCircle size={20} color="#10b981" />
                            <span style={{ fontWeight: 'bold', color: '#065f46' }}>
                              Uyumlu Lisanslar ({selectedAnalysis.licenseReport.allowed.length})
                            </span>
                          </div>
                          {expandedLicenseTypes.allowed ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                        
                        {expandedLicenseTypes.allowed && (
                          <div style={{ padding: '16px', backgroundColor: '#f9fafb' }}>
                            {getFilteredLicenses(selectedAnalysis.licenseReport.allowed).length === 0 ? (
                              <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>
                                {searchTerm ? 'Aramanızla eşleşen uyumlu paket bulunamadı.' : 'Uyumlu paket bulunamadı.'}
                              </div>
                            ) : (
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: '12px'
                              }}>
                                {getFilteredLicenses(selectedAnalysis.licenseReport.allowed).map((item, index) => (
                                  <div
                                    key={index}
                                    style={{
                                      backgroundColor: 'white',
                                      border: '1px solid #10b981',
                                      borderRadius: '8px',
                                      padding: '12px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                      <span style={{ fontWeight: 'bold', color: '#111827' }}>
                                        {item.package}
                                      </span>
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        backgroundColor: '#10b981',
                                        color: 'white'
                                      }}>
                                        v{item.version}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        backgroundColor: '#dcfce7',
                                        color: '#166534'
                                      }}>
                                        {item.license}
                                      </span>
                                      {item.repository && (
                                        <a
                                          href={item.repository}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '12px',
                                            color: '#3b82f6'
                                          }}
                                        >
                                          <ExternalLink size={12} />
                                          Repo
                                        </a>
                                      )}
                                    </div>
                                    {item.publisher && (
                                      <div style={{
                                        fontSize: '12px',
                                        color: '#6b7280',
                                        marginTop: '4px'
                                      }}>
                                        Yayıncı: {item.publisher}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Yasaklı Lisanslar */}
                    {selectedAnalysis.licenseReport.banned && selectedAnalysis.licenseReport.banned.length > 0 && (
                      <div style={{
                        marginBottom: '16px',
                        border: '2px solid #ef4444',
                        borderRadius: '12px',
                        overflow: 'hidden'
                      }}>
                        <div
                          onClick={() => toggleLicenseType('banned')}
                          style={{
                            backgroundColor: '#fee2e2',
                            padding: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <XCircle size={20} color="#ef4444" />
                            <span style={{ fontWeight: 'bold', color: '#7f1d1d' }}>
                              Yasaklı Lisanslar ({selectedAnalysis.licenseReport.banned.length})
                            </span>
                          </div>
                          {expandedLicenseTypes.banned ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                        
                        {expandedLicenseTypes.banned && (
                          <div style={{ padding: '16px', backgroundColor: '#fef2f2' }}>
                            {getFilteredLicenses(selectedAnalysis.licenseReport.banned).length === 0 ? (
                              <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>
                                {searchTerm ? 'Aramanızla eşleşen yasaklı paket bulunamadı.' : 'Yasaklı paket bulunamadı.'}
                              </div>
                            ) : (
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: '12px'
                              }}>
                                {getFilteredLicenses(selectedAnalysis.licenseReport.banned).map((item, index) => (
                                  <div
                                    key={index}
                                    style={{
                                      backgroundColor: 'white',
                                      border: '1px solid #ef4444',
                                      borderRadius: '8px',
                                      padding: '12px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                      <span style={{ fontWeight: 'bold', color: '#111827' }}>
                                        {item.package}
                                      </span>
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        backgroundColor: '#ef4444',
                                        color: 'white'
                                      }}>
                                        v{item.version}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        backgroundColor: '#fee2e2',
                                        color: '#991b1b'
                                      }}>
                                        {item.license}
                                      </span>
                                      {item.repository && (
                                        <a
                                          href={item.repository}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '12px',
                                            color: '#3b82f6'
                                          }}
                                        >
                                          <ExternalLink size={12} />
                                          Repo
                                        </a>
                                      )}
                                    </div>
                                    <div style={{
                                      display: 'inline-block',
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: '500',
                                      backgroundColor: '#fee2e2',
                                      color: '#dc2626',
                                      marginBottom: '8px'
                                    }}>
                                      ⚠ Yüksek Risk
                                    </div>
                                    {item.publisher && (
                                      <div style={{
                                        fontSize: '12px',
                                        color: '#6b7280',
                                        marginTop: '4px'
                                      }}>
                                        Yayıncı: {item.publisher}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* İnceleme Gereken Lisanslar */}
                    {selectedAnalysis.licenseReport.needsReview && selectedAnalysis.licenseReport.needsReview.length > 0 && (
                      <div style={{
                        marginBottom: '16px',
                        border: '2px solid #f59e0b',
                        borderRadius: '12px',
                        overflow: 'hidden'
                      }}>
                        <div
                          onClick={() => toggleLicenseType('needsReview')}
                          style={{
                            backgroundColor: '#fef3c7',
                            padding: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertCircle size={20} color="#f59e0b" />
                            <span style={{ fontWeight: 'bold', color: '#92400e' }}>
                              İnceleme Gereken Lisanslar ({selectedAnalysis.licenseReport.needsReview.length})
                            </span>
                          </div>
                          {expandedLicenseTypes.needsReview ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                        
                        {expandedLicenseTypes.needsReview && (
                          <div style={{ padding: '16px', backgroundColor: '#fffbeb' }}>
                            {getFilteredLicenses(selectedAnalysis.licenseReport.needsReview).length === 0 ? (
                              <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>
                                {searchTerm ? 'Aramanızla eşleşen paket bulunamadı.' : 'İnceleme gereken paket bulunamadı.'}
                              </div>
                            ) : (
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: '12px'
                              }}>
                                {getFilteredLicenses(selectedAnalysis.licenseReport.needsReview).map((item, index) => (
                                  <div
                                    key={index}
                                    style={{
                                      backgroundColor: 'white',
                                      border: '1px solid #f59e0b',
                                      borderRadius: '8px',
                                      padding: '12px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                      <span style={{ fontWeight: 'bold', color: '#111827' }}>
                                        {item.package}
                                      </span>
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        backgroundColor: '#f59e0b',
                                        color: 'white'
                                      }}>
                                        v{item.version}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        backgroundColor: '#fef3c7',
                                        color: '#92400e'
                                      }}>
                                        {item.license}
                                      </span>
                                      {item.repository && (
                                        <a
                                          href={item.repository}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '12px',
                                            color: '#3b82f6'
                                          }}
                                        >
                                          <ExternalLink size={12} />
                                          Repo
                                        </a>
                                      )}
                                    </div>
                                    <div style={{
                                      display: 'inline-block',
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: '500',
                                      backgroundColor: '#fef3c7',
                                      color: '#d97706',
                                      marginBottom: '8px'
                                    }}>
                                      ⚠ Orta Risk
                                    </div>
                                    {item.publisher && (
                                      <div style={{
                                        fontSize: '12px',
                                        color: '#6b7280',
                                        marginTop: '4px'
                                      }}>
                                        Yayıncı: {item.publisher}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bilinmeyen Lisanslar */}
                    {selectedAnalysis.licenseReport.unknown && selectedAnalysis.licenseReport.unknown.length > 0 && (
                      <div style={{
                        marginBottom: '16px',
                        border: '2px solid #6b7280',
                        borderRadius: '12px',
                        overflow: 'hidden'
                      }}>
                        <div
                          onClick={() => toggleLicenseType('unknown')}
                          style={{
                            backgroundColor: '#f3f4f6',
                            padding: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertCircle size={20} color="#6b7280" />
                            <span style={{ fontWeight: 'bold', color: '#374151' }}>
                              Bilinmeyen Lisanslar ({selectedAnalysis.licenseReport.unknown.length})
                            </span>
                          </div>
                          {expandedLicenseTypes.unknown ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                        
                        {expandedLicenseTypes.unknown && (
                          <div style={{ padding: '16px', backgroundColor: '#f9fafb' }}>
                            {getFilteredLicenses(selectedAnalysis.licenseReport.unknown).length === 0 ? (
                              <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>
                                {searchTerm ? 'Aramanızla eşleşen paket bulunamadı.' : 'Bilinmeyen lisanslı paket bulunamadı.'}
                              </div>
                            ) : (
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: '12px'
                              }}>
                                {getFilteredLicenses(selectedAnalysis.licenseReport.unknown).map((item, index) => (
                                  <div
                                    key={index}
                                    style={{
                                      backgroundColor: 'white',
                                      border: '1px solid #6b7280',
                                      borderRadius: '8px',
                                      padding: '12px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                      <span style={{ fontWeight: 'bold', color: '#111827' }}>
                                        {item.package}
                                      </span>
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        backgroundColor: '#6b7280',
                                        color: 'white'
                                      }}>
                                        v{item.version}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        backgroundColor: '#f3f4f6',
                                        color: '#4b5563'
                                      }}>
                                        {item.license}
                                      </span>
                                      {item.repository && (
                                        <a
                                          href={item.repository}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '12px',
                                            color: '#3b82f6'
                                          }}
                                        >
                                          <ExternalLink size={12} />
                                          Repo
                                        </a>
                                      )}
                                    </div>
                                    <div style={{
                                      fontSize: '12px',
                                      color: '#6b7280',
                                      fontStyle: 'italic',
                                      marginTop: '8px'
                                    }}>
                                      Lisans tipi belirlenemedi, manuel inceleme önerilir.
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* SBOM Verisi */}
                  {selectedAnalysis.sbomData && (
                    <div>
                      <h4 style={{
                        fontWeight: 'bold',
                        color: '#1f2937',
                        fontSize: '20px',
                        marginBottom: '16px'
                      }}>
                        SBOM Detayları
                      </h4>
                      <div style={{
                        backgroundColor: '#f9fafb',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '2px solid #e5e7eb',
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}>
                        <pre style={{
                          fontSize: '12px',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'monospace',
                          lineHeight: '1.5'
                        }}>
                          {JSON.stringify(selectedAnalysis.sbomData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '48px 20px',
                  color: '#6b7280'
                }}>
                  <AlertCircle size={64} color="#9ca3af" style={{ marginBottom: '16px' }} />
                  <p style={{ fontSize: '18px', marginBottom: '8px' }}>
                    Analiz sonuçları henüz hazır değil veya bir hata oluştu.
                  </p>
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