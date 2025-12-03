const fs = require('fs');
const path = require('path');

// Lisans politikasını yükle
const policy = require('../.license-policy.json');

function extractLicensesFromNpmList(data, prefix = '') {
  let licenses = [];
  
  if (!data) return licenses;
  
  // Mevcut paketin lisansını kontrol et
  if (data.name && data.license) {
    licenses.push({
      package: data.name,
      version: data.version || 'N/A',
      license: data.license,
      path: prefix
    });
  }
  
  // Bağımlılıkları recursive olarak kontrol et
  if (data.dependencies) {
    for (const [depName, depData] of Object.entries(data.dependencies)) {
      const depLicenses = extractLicensesFromNpmList(depData, prefix + ' > ' + depName);
      licenses = licenses.concat(depLicenses);
    }
  }
  
  return licenses;
}

function checkLicenseCompliance(licenses) {
  const violations = [];
  const warnings = [];
  
  licenses.forEach(item => {
    const license = item.license;
    
    // Yasaklı lisansları kontrol et
    if (policy.bannedLicenses.includes(license)) {
      violations.push({
        ...item,
        severity: 'BLOCKER',
        reason: `Yasaklı lisans: ${license}`
      });
    }
    // İnceleme gerektiren lisansları kontrol et
    else if (policy.reviewRequired.some(pattern => {
      const regexPattern = pattern.replace('*', '.*');
      return new RegExp(regexPattern).test(license);
    })) {
      warnings.push({
        ...item,
        severity: 'WARNING',
        reason: `İnceleme gerektiren lisans: ${license}`
      });
    }
    // İzin verilen lisansları kontrol et (opsiyonel)
    else if (!policy.allowedLicenses.includes(license)) {
      warnings.push({
        ...item,
        severity: 'INFO',
        reason: `Politikada tanımlanmamış lisans: ${license}`
      });
    }
  });
  
  return { violations, warnings };
}

function main() {
  console.log('📦 Lisans Uyumluluk Kontrolü Başlıyor...\n');
  
  // Backend bağımlılıklarını kontrol et
  console.log('🔧 Backend Kontrolü:');
  const backendData = require('../backend-nest/dependencies-backend.json');
  const backendLicenses = extractLicensesFromNpmList(backendData, 'backend');
  const backendResults = checkLicenseCompliance(backendLicenses);
  
  console.log(`   Toplam bağımlılık: ${backendLicenses.length}`);
  console.log(`   İhlaller: ${backendResults.violations.length}`);
  console.log(`   Uyarılar: ${backendResults.warnings.length}`);
  
  // Frontend bağımlılıklarını kontrol et
  console.log('\n🎨 Frontend Kontrolü:');
  const frontendData = require('../frontend-react/dependencies-frontend.json');
  const frontendLicenses = extractLicensesFromNpmList(frontendData, 'frontend');
  const frontendResults = checkLicenseCompliance(frontendLicenses);
  
  console.log(`   Toplam bağımlılık: ${frontendLicenses.length}`);
  console.log(`   İhlaller: ${frontendResults.violations.length}`);
  console.log(`   Uyarılar: ${frontendResults.warnings.length}`);
  
  // Sonuçları göster
  console.log('\n🚨 İHLALLER:');
  if (backendResults.violations.length === 0 && frontendResults.violations.length === 0) {
    console.log('   ✓ Hiç yasaklı lisans bulunamadı');
  } else {
    [...backendResults.violations, ...frontendResults.violations].forEach(violation => {
      console.log(`   ✗ ${violation.package}@${violation.version} - ${violation.license}`);
      console.log(`     Sebep: ${violation.reason}`);
    });
  }
  
  console.log('\n⚠️  UYARILAR:');
  if (backendResults.warnings.length === 0 && frontendResults.warnings.length === 0) {
    console.log('   ✓ Hiç uyarı bulunamadı');
  } else {
    [...backendResults.warnings, ...frontendResults.warnings].forEach(warning => {
      console.log(`   ! ${warning.package}@${warning.version} - ${warning.license}`);
      console.log(`     Sebep: ${warning.reason}`);
    });
  }
  
  // Çıkış kodu
  const hasBlockers = backendResults.violations.length > 0 || frontendResults.violations.length > 0;
  if (hasBlockers) {
    console.log('\n❌ Lisans ihlalleri bulundu! Build başarısız olmalı.');
    process.exit(1);
  } else {
    console.log('\n✅ Tüm lisanslar uyumlu!');
    process.exit(0);
  }
}

// Script'i çalıştır
if (require.main === module) {
  main();
}

module.exports = { extractLicensesFromNpmList, checkLicenseCompliance };
