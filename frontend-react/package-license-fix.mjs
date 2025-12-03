import { readFileSync, writeFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

if (!packageJson.license) {
  packageJson.license = 'MIT';
  console.log('Frontend lisansı MIT olarak ayarlandı');
}

if (!packageJson.repository) {
  packageJson.repository = {
    type: 'git',
    url: 'https://github.com/yourusername/fullstack-proje.git'
  };
  console.log('Repository bilgisi eklendi');
}

writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
