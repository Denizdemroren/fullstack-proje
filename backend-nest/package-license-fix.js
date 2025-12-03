const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (!packageJson.license) {
  packageJson.license = 'MIT';
  console.log('Backend lisansı MIT olarak ayarlandı');
}

if (!packageJson.repository) {
  packageJson.repository = {
    type: 'git',
    url: 'https://github.com/yourusername/fullstack-proje.git'
  };
  console.log('Repository bilgisi eklendi');
}

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
