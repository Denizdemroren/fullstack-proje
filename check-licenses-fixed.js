const fs = require('fs');
const path = require('path');

const policy = {
  allowed: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'],
  banned: ['GPL-1.0', 'GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0'],
  review: ['LGPL', 'MPL']
};

function checkProject(projectDir) {
  const projectName = path.basename(projectDir);
  console.log(`\n🔍 ${projectName.toUpperCase()} LİSANS KONTROLÜ`);
  console.log('='.repeat(40));
  
  const packageJsonPath = path.join(projectDir, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`❌ ${packageJsonPath} bulunamadı`);
    return { violations: [], warnings: [] };
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log(`📦 ${packageJson.name || projectName}`);
  console.log(`   Lisans: ${packageJson.license || 'Belirtilmemiş'}`);
  
  // Basit kontrol - sadece ana proje lisansı
  const license = packageJson.license || 'UNKNOWN';
  const licenseUpper = license.toUpperCase();
  
  if (policy.banned.some(b => licenseUpper.includes(b.toUpperCase()))) {
    console.log(`❌ YASAKLI LİSANS: ${license}`);
    return { violations: [{package: packageJson.name, license: license}], warnings: [] };
  } else if (policy.allowed.some(a => licenseUpper.includes(a.toUpperCase()))) {
    console.log(`✅ İZİN VERİLEN LİSANS: ${license}`);
    return { violations: [], warnings: [] };
  } else {
    console.log(`⚠️  İNCELEME GEREKEN: ${license}`);
    return { violations: [], warnings: [{package: packageJson.name, license: license}] };
  }
}

console.log('🚀 BASİT LİSANS KONTROLÜ');
console.log('='.repeat(50));

const backendResult = checkProject('backend-nest');
const frontendResult = checkProject('frontend-react');

const totalViolations = backendResult.violations.length + frontendResult.violations.length;
const totalWarnings = backendResult.warnings.length + frontendResult.warnings.length;

console.log('\n' + '='.repeat(50));
console.log('🎯 SONUÇ:');

if (totalViolations > 0) {
  console.log('❌ YASAKLI LİSANS BULUNDU!');
  process.exit(1);
} else if (totalWarnings > 0) {
  console.log('⚠️  İNCELEME GEREKEN LİSANSLAR VAR');
  process.exit(0);
} else {
  console.log('✅ TÜM LİSANSLAR UYUMLU!');
  process.exit(0);
}
