const fs = require('fs');
const path = require('path');

// Lisans politikasını yükle
const policy = {
  allowed: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'],
  banned: ['GPL-1.0', 'GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0'],
  review: ['LGPL', 'MPL']
};

function checkProject(projectName) {
  console.log(`\n🔍 ${projectName.toUpperCase()} LİSANS KONTROLÜ`);
  console.log('=' .repeat(40));
  
  const projectPath = path.join(__dirname, projectName);
  const packageJsonPath = path.join(projectPath, 'package.json');
  const packageLockPath = path.join(projectPath, 'package-lock.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`❌ ${packageJsonPath} bulunamadı`);
    return { violations: [], warnings: [] };
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Ana proje lisansı
  console.log(`📦 Ana Proje: ${packageJson.name || projectName}`);
  console.log(`   Lisans: ${packageJson.license || 'Belirtilmemiş'}`);
  console.log(`   Versiyon: ${packageJson.version || 'N/A'}`);
  
  const results = {
    violations: [],
    warnings: [],
    dependencies: {}
  };
  
  // package-lock.json'dan bağımlılıkları oku
  if (fs.existsSync(packageLockPath)) {
    try {
      const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
      
      if (packageLock.packages) {
        console.log(`\n📋 Bağımlılık Taraması:`);
        
        let total = 0;
        const licenseCount = {};
        
        for (const [pkgPath, pkgData] of Object.entries(packageLock.packages)) {
          if (pkgPath && pkgData.name && pkgData.version) {
            total++;
            const license = pkgData.license || 'UNKNOWN';
            
            // Lisans sayısını tut
            licenseCount[license] = (licenseCount[license] || 0) + 1;
            
            // Lisans kontrolü
            const licenseUpper = license.toUpperCase();
            let status = '✅';
            let reason = '';
            
            // Yasaklı lisans kontrolü
            if (policy.banned.some(banned => licenseUpper.includes(banned.toUpperCase()))) {
              status = '❌';
              reason = `Yasaklı lisans: ${license}`;
              results.violations.push({
                package: pkgData.name,
                version: pkgData.version,
                license: license,
                reason: reason
              });
            }
            // İnceleme gerektiren lisans
            else if (policy.review.some(review => licenseUpper.includes(review.toUpperCase()))) {
              status = '⚠️';
              reason = `İnceleme gerektiren lisans: ${license}`;
              results.warnings.push({
                package: pkgData.name,
                version: pkgData.version,
                license: license,
                reason: reason
              });
            }
            // İzin verilen lisans
            else if (policy.allowed.some(allowed => licenseUpper.includes(allowed.toUpperCase()))) {
              status = '✅';
              reason = `İzin verilen lisans: ${license}`;
            }
            // Bilinmeyen lisans
            else if (license !== 'UNKNOWN') {
              status = '❓';
              reason = `Bilinmeyen lisans: ${license}`;
              results.warnings.push({
                package: pkgData.name,
                version: pkgData.version,
                license: license,
                reason: reason
              });
            }
            
            // İlk 5 bağımlılığı göster
            if (total <= 5) {
              console.log(`   ${status} ${pkgData.name}@${pkgData.version}`);
              if (reason) console.log(`      ${reason}`);
            }
          }
        }
        
        // İstatistikler
        console.log(`\n📊 İSTATİSTİKLER:`);
        console.log(`   • Toplam bağımlılık: ${total}`);
        console.log(`   • Yasaklı lisans: ${results.violations.length}`);
        console.log(`   • Uyarı/İnceleme: ${results.warnings.length}`);
        
        // Lisans dağılımı (en çok kullanılan 5 lisans)
        console.log(`\n📈 LİSANS DAĞILIMI (TOP 5):`);
        Object.entries(licenseCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([license, count]) => {
            console.log(`   • ${license}: ${count} paket`);
          });
      }
    } catch (error) {
      console.log(`❌ package-lock.json okunamadı: ${error.message}`);
    }
  } else {
    console.log(`❌ package-lock.json bulunamadı`);
  }
  
  return results;
}

// Ana fonksiyon
console.log('🚀 LİSANS UYUMLULUK KONTROLÜ BAŞLATILIYOR');
console.log('=' .repeat(50));

// Backend'i kontrol et
const backendResults = checkProject('backend-nest');

// Frontend'i kontrol et
const frontendResults = checkProject('frontend-react');

// Sonuç özeti
console.log('\n' + '=' .repeat(50));
console.log('🎯 SONUÇ ÖZETİ');
console.log('=' .repeat(50));

const totalViolations = backendResults.violations.length + frontendResults.violations.length;
const totalWarnings = backendResults.warnings.length + frontendResults.warnings.length;

console.log(`\n📋 GENEL DURUM:`);
console.log(`   • Toplam yasaklı lisans: ${totalViolations}`);
console.log(`   • Toplam uyarı/inceleme: ${totalWarnings}`);

if (totalViolations > 0) {
  console.log('\n🚨 KRİTİK HATA: Yasaklı lisanslar bulundu!');
  console.log('\nYasaklı Paketler:');
  [...backendResults.violations, ...frontendResults.violations].forEach((violation, index) => {
    console.log(`   ${index + 1}. ${violation.package}@${violation.version}`);
    console.log(`      Lisans: ${violation.license}`);
    console.log(`      Sebep: ${violation.reason}`);
  });
  console.log('\n❌ BUILD BAŞARISIZ: Lisans politikası ihlali!');
  process.exit(1);
} else if (totalWarnings > 0) {
  console.log('\n⚠️  UYARI: İnceleme gereken lisanslar bulundu.');
  console.log('\nİnceleme Gerekenler (ilk 5):');
  [...backendResults.warnings, ...frontendResults.warnings]
    .slice(0, 5)
    .forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning.package}@${warning.version}`);
      console.log(`      Lisans: ${warning.license}`);
    });
  if (totalWarnings > 5) {
    console.log(`   ...ve ${totalWarnings - 5} daha`);
  }
  console.log('\n✅ BUILD BAŞARILI (uyarılar var)');
  process.exit(0);
} else {
  console.log('\n🎉 TEBRİKLER!');
  console.log('✅ Tüm lisanslar uyumlu, hiçbir uyarı bulunamadı.');
  console.log('✅ BUILD BAŞARILI');
  process.exit(0);
}
