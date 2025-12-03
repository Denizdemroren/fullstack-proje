const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Lisans politikasını yükle
const policy = require('../.license-policy.json');

function runCommand(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8' });
  } catch (error) {
    console.error(`Komut hatası (${cmd}):`, error.message);
    return null;
  }
}

function extractLicensesFromPackage(packagePath) {
  const packageJsonPath = path.join(packagePath, 'package.json');
  const packageLockPath = path.join(packagePath, 'package-lock.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`package.json bulunamadı: ${packagePath}`);
    return [];
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const licenses = [];
  
  // Ana paketin lisansı
  if (packageJson.name) {
    licenses.push({
      package: packageJson.name,
      version: packageJson.version || 'N/A',
      license: packageJson.license || 'UNKNOWN',
      type: 'direct'
    });
  }
  
  // npm ls komutu ile lisansları al
  console.log(`\n🔍 ${packageJson.name || packagePath} bağımlılıkları taranıyor...`);
  
  try {
    // npm list çıktısını al
    const npmListOutput = runCommand('npm list --all --json', packagePath);
    if (npmListOutput) {
      const npmData = JSON.parse(npmListOutput);
      parseDependencies(npmData, licenses);
    }
  } catch (error) {
    console.log(`npm list hatası: ${error.message}`);
    
    // Alternatif: package-lock.json'dan oku
    if (fs.existsSync(packageLockPath)) {
      console.log('package-lock.json kullanılıyor...');
      const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
      parsePackageLock(packageLock, licenses);
    }
  }
  
  return licenses;
}

function parseDependencies(data, licenses, depth = 0) {
  if (!data || depth > 10) return; // Recursion limit
  
  if (data.name && data.version && !licenses.some(l => 
    l.package === data.name && l.version === data.version)) {
    
    // Lisans bilgisini farklı formatlarda arayalım
    let license = 'UNKNOWN';
    
    if (data.license) {
      license = data.license;
    } else if (data.licenses && Array.isArray(data.licenses)) {
      license = data.licenses.map(l => l.type || l).join(', ');
    }
    
    if (license !== 'UNKNOWN') {
      licenses.push({
        package: data.name,
        version: data.version,
        license: license,
        type: depth === 0 ? 'direct' : 'transitive'
      });
    }
  }
  
  // Recursive olarak bağımlılıkları kontrol et
  if (data.dependencies) {
    Object.values(data.dependencies).forEach(dep => {
      parseDependencies(dep, licenses, depth + 1);
    });
  }
}

function parsePackageLock(packageLock, licenses) {
  if (packageLock.packages) {
    for (const [pkgPath, pkgData] of Object.entries(packageLock.packages)) {
      if (pkgPath && pkgData.name && pkgData.version) {
        const license = pkgData.license || 
                       (pkgData.licenses && Array.isArray(pkgData.licenses) ? 
                        pkgData.licenses.map(l => l.type || l).join(', ') : 'UNKNOWN');
        
        if (license !== 'UNKNOWN') {
          licenses.push({
            package: pkgData.name,
            version: pkgData.version,
            license: license,
            type: pkgPath === '' ? 'direct' : 'transitive'
          });
        }
      }
    }
  }
}

function checkLicenseCompliance(licenses) {
  const violations = [];
  const warnings = [];
  const allowed = [];
  
  // Benzersiz paketleri kontrol et (aynı paketin farklı versiyonlarını birleştir)
  const uniquePackages = {};
  licenses.forEach(item => {
    const key = `${item.package}@${item.license}`;
    if (!uniquePackages[key]) {
      uniquePackages[key] = item;
    }
  });
  
  Object.values(uniquePackages).forEach(item => {
    const license = item.license.toString().toUpperCase();
    
    // Yasaklı lisansları kontrol et
    const isBanned = policy.bannedLicenses.some(banned => 
      license.includes(banned.toUpperCase().replace('-ONLY', ''))
    );
    
    if (isBanned) {
      violations.push({
        ...item,
        severity: 'BLOCKER',
        reason: `Yasaklı lisans tespit edildi: ${license}`
      });
      return;
    }
    
    // İnceleme gerektiren lisansları kontrol et
    const needsReview = policy.reviewRequired.some(pattern => {
      const cleanPattern = pattern.replace('*', '').toUpperCase();
      return license.includes(cleanPattern);
    });
    
    if (needsReview) {
      warnings.push({
        ...item,
        severity: 'REVIEW_REQUIRED',
        reason: `İnceleme gerektiren lisans: ${license}`
      });
      return;
    }
    
    // İzin verilen lisansları kontrol et
    const isAllowed = policy.allowedLicenses.some(allowed => 
      license.includes(allowed.toUpperCase())
    );
    
    if (isAllowed) {
      allowed.push({
        ...item,
        severity: 'ALLOWED',
        reason: `İzin verilen lisans: ${license}`
      });
    } else {
      warnings.push({
        ...item,
        severity: 'UNKNOWN',
        reason: `Politikada tanımlanmamış lisans: ${license}`
      });
    }
  });
  
  return { violations, warnings, allowed };
}

function main() {
  console.log('📦 Gelişmiş Lisans Uyumluluk Kontrolü\n');
  console.log('=' .repeat(50));
  
  // Backend'i kontrol et
  const backendPath = path.join(__dirname, '../backend-nest');
  console.log(`\n🔧 BACKEND: ${backendPath}`);
  
  const backendLicenses = extractLicensesFromPackage(backendPath);
  const backendResults = checkLicenseCompliance(backendLicenses);
  
  console.log(`\n📊 Backend İstatistikleri:`);
  console.log(`   • Toplam benzersiz paket: ${Object.keys(backendLicenses.reduce((acc, l) => {
    acc[`${l.package}@${l.version}`] = true;
    return acc;
  }, {})).length}`);
  console.log(`   • İzin verilenler: ${backendResults.allowed.length}`);
  console.log(`   • İnceleme gerekenler: ${backendResults.warnings.filter(w => w.severity === 'REVIEW_REQUIRED').length}`);
  console.log(`   • Bilinmeyenler: ${backendResults.warnings.filter(w => w.severity === 'UNKNOWN').length}`);
  console.log(`   • Yasaklılar: ${backendResults.violations.length}`);
  
  // Frontend'i kontrol et
  const frontendPath = path.join(__dirname, '../frontend-react');
  console.log(`\n🎨 FRONTEND: ${frontendPath}`);
  
  const frontendLicenses = extractLicensesFromPackage(frontendPath);
  const frontendResults = checkLicenseCompliance(frontendLicenses);
  
  console.log(`\n📊 Frontend İstatistikleri:`);
  console.log(`   • Toplam benzersiz paket: ${Object.keys(frontendLicenses.reduce((acc, l) => {
    acc[`${l.package}@${l.version}`] = true;
    return acc;
  }, {})).length}`);
  console.log(`   • İzin verilenler: ${frontendResults.allowed.length}`);
  console.log(`   • İnceleme gerekenler: ${frontendResults.warnings.filter(w => w.severity === 'REVIEW_REQUIRED').length}`);
  console.log(`   • Bilinmeyenler: ${frontendResults.warnings.filter(w => w.severity === 'UNKNOWN').length}`);
  console.log(`   • Yasaklılar: ${frontendResults.violations.length}`);
  
  // Sonuçları göster
  console.log('\n' + '=' .repeat(50));
  console.log('\n🚨 KRİTİK İHLALLER (YASAKLI LİSANSLAR):');
  
  const allViolations = [...backendResults.violations, ...frontendResults.violations];
  if (allViolations.length === 0) {
    console.log('   ✅ Hiç yasaklı lisans bulunamadı');
  } else {
    allViolations.forEach((violation, index) => {
      console.log(`\n   ${index + 1}. ${violation.package}@${violation.version}`);
      console.log(`      Lisans: ${violation.license}`);
      console.log(`      Tip: ${violation.type}`);
      console.log(`      Sebep: ${violation.reason}`);
    });
  }
  
  console.log('\n⚠️  UYARI VE İNCELEME GEREKENLER:');
  
  const allWarnings = [...backendResults.warnings, ...frontendResults.warnings];
  const reviewWarnings = allWarnings.filter(w => w.severity === 'REVIEW_REQUIRED');
  const unknownWarnings = allWarnings.filter(w => w.severity === 'UNKNOWN');
  
  if (reviewWarnings.length > 0) {
    console.log('\n   🔍 İNCELEME GEREKEN LİSANSLAR:');
    reviewWarnings.slice(0, 10).forEach((warning, index) => {
      console.log(`      ${index + 1}. ${warning.package}@${warning.version} - ${warning.license}`);
    });
    if (reviewWarnings.length > 10) {
      console.log(`      ...ve ${reviewWarnings.length - 10} daha`);
    }
  }
  
  if (unknownWarnings.length > 0) {
    console.log('\n   ❓ BİLİNMEYEN/TANIMSIZ LİSANSLAR:');
    unknownWarnings.slice(0, 10).forEach((warning, index) => {
      console.log(`      ${index + 1}. ${warning.package}@${warning.version} - ${warning.license}`);
    });
    if (unknownWarnings.length > 10) {
      console.log(`      ...ve ${unknownWarnings.length - 10} daha`);
    }
  }
  
  if (reviewWarnings.length === 0 && unknownWarnings.length === 0) {
    console.log('   ✅ Hiç uyarı veya inceleme gereken lisans bulunamadı');
  }
  
  console.log('\n' + '=' .repeat(50));
  
  // Lisans dağılımı
  console.log('\n📈 LİSANS DAĞILIMI:');
  
  const allLicenses = [...backendLicenses, ...frontendLicenses];
  const licenseCount = {};
  allLicenses.forEach(item => {
    licenseCount[item.license] = (licenseCount[item.license] || 0) + 1;
  });
  
  Object.entries(licenseCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([license, count], index) => {
      const status = policy.allowedLicenses.some(l => license.includes(l)) ? '✅' :
                    policy.bannedLicenses.some(l => license.includes(l)) ? '❌' :
                    policy.reviewRequired.some(l => license.includes(l.replace('*', ''))) ? '⚠️' : '❓';
      console.log(`   ${status} ${license.padEnd(30)}: ${count} paket`);
    });
  
  // Çıkış kodu
  const hasBlockers = allViolations.length > 0;
  console.log('\n' + '=' .repeat(50));
  
  if (hasBlockers) {
    console.log('\n❌ KRİTİK: Yasaklı lisanslar bulundu! Build başarısız olmalı.');
    process.exit(1);
  } else {
    console.log('\n✅ BAŞARILI: Temel lisans kontrolleri geçildi.');
    console.log('   Not: İnceleme gereken lisanslar için manuel kontrol önerilir.');
    process.exit(0);
  }
}

// Script'i çalıştır
if (require.main === module) {
  main();
}

module.exports = { extractLicensesFromPackage, checkLicenseCompliance };
