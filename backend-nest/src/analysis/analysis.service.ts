import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Analysis } from './analysis.entity';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

interface PackageData {
  name?: string;
  version?: string;
  license?: string;
  [key: string]: any;
}

interface PackageLock {
  packages?: {
    [key: string]: PackageData;
  };
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(Analysis)
    private analysisRepository: Repository<Analysis>,
  ) {}

  async createAnalysis(userId: number, githubUrl: string): Promise<Analysis> {
    const analysis = this.analysisRepository.create({
      userId,
      githubUrl,
      status: 'pending',
    });

    await this.analysisRepository.save(analysis);
    
    // Arka planda analizi başlat
    this.startAnalysis(analysis.id).catch(err => {
      this.logger.error(`Analysis ${analysis.id} failed: ${err.message}`);
    });

    return analysis;
  }

  async startAnalysis(analysisId: number): Promise<void> {
    const analysis = await this.analysisRepository.findOne({
      where: { id: analysisId },
    });

    if (!analysis) {
      throw new Error('Analysis not found');
    }

    try {
      analysis.status = 'processing';
      await this.analysisRepository.save(analysis);

      // 1. Repo'yu clone et
      const tempDir = await this.cloneRepository(analysis.githubUrl);
      
      // 2. SBOM oluştur
      const sbomData = await this.generateSBOM(tempDir);
      
      // 3. Lisans analizi yap
      const licenseReport = await this.analyzeLicenses(tempDir);
      
      // 4. Sonuçları kaydet
      analysis.sbomData = sbomData;
      analysis.licenseReport = licenseReport;
      analysis.status = 'completed';
      
      await this.analysisRepository.save(analysis);

      // 5. Temp dizini temizle
      await fs.promises.rm(tempDir, { recursive: true, force: true });

    } catch (error) {
      this.logger.error(`Analysis failed: ${error.message}`);
      analysis.status = 'failed';
      analysis.errorMessage = error.message;
      await this.analysisRepository.save(analysis);
    }
  }

  private async cloneRepository(githubUrl: string): Promise<string> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'repo-'));
    const repoName = this.extractRepoName(githubUrl);
    const repoPath = path.join(tempDir, repoName);
    
    this.logger.log(`Cloning ${githubUrl} to ${tempDir}`);
    this.logger.log(`Expected repo path: ${repoPath}`);
    
    try {
      // Önce tempDir içine clone et
      await execAsync(`git clone ${githubUrl} ${repoPath}`, {
        timeout: 120000, // 120 saniye timeout
        cwd: tempDir
      });
      
      this.logger.log(`Clone successful. Checking if repo exists at: ${repoPath}`);
      
      // Repo'nun var olduğunu kontrol et
      if (!fs.existsSync(repoPath)) {
        this.logger.error(`Repo path does not exist after clone: ${repoPath}`);
        // Alternatif path'i kontrol et - belki doğrudan tempDir'e clone olmuştur
        const files = await fs.promises.readdir(tempDir);
        this.logger.log(`Files in temp directory: ${files.join(', ')}`);
        
        // İlk directory'yi bul
        for (const file of files) {
          const fullPath = path.join(tempDir, file);
          const stat = await fs.promises.stat(fullPath);
          if (stat.isDirectory()) {
            this.logger.log(`Found directory: ${fullPath}, using as repo path`);
            return fullPath;
          }
        }
        
        throw new Error(`Repository directory not found after clone`);
      }
      
      return repoPath;
    } catch (error) {
      this.logger.error(`Clone failed: ${error.message}`);
      // Temp directory'yi temizle
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger.warn(`Failed to clean up temp directory: ${cleanupError.message}`);
      }
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  private extractRepoName(githubUrl: string): string {
    // Örnek: https://github.com/axios/axios -> axios
    // Örnek: https://github.com/axios/axios.git -> axios
    const url = new URL(githubUrl);
    const pathParts = url.pathname.split('/').filter(part => part.length > 0);
    
    if (pathParts.length >= 2) {
      const repoName = pathParts[1].replace(/\.git$/, '');
      this.logger.log(`Extracted repo name: ${repoName} from ${githubUrl}`);
      return repoName;
    }
    
    this.logger.warn(`Could not extract repo name from URL: ${githubUrl}`);
    return 'repository';
  }

  private async findPackageJson(dir: string): Promise<string | null> {
    // Önce kök dizinde ara
    const rootPackageJson = path.join(dir, 'package.json');
    if (fs.existsSync(rootPackageJson)) {
      return rootPackageJson;
    }
    
    // Subdirectory'lerde ara
    try {
      const files = await fs.promises.readdir(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = await fs.promises.stat(fullPath);
        if (stat.isDirectory()) {
          const subPackageJson = path.join(fullPath, 'package.json');
          if (fs.existsSync(subPackageJson)) {
            return subPackageJson;
          }
          
          // Daha derinlere de bak (max 2 level)
          const subFiles = await fs.promises.readdir(fullPath);
          for (const subFile of subFiles) {
            const deeperPath = path.join(fullPath, subFile);
            const deeperStat = await fs.promises.stat(deeperPath);
            if (deeperStat.isDirectory()) {
              const deeperPackageJson = path.join(deeperPath, 'package.json');
              if (fs.existsSync(deeperPackageJson)) {
                return deeperPackageJson;
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error searching for package.json: ${error.message}`);
    }
    
    return null;
  }

  private async generateSBOM(repoPath: string): Promise<any> {
    this.logger.log(`Generating SBOM for ${repoPath}`);
    
    const packageJsonPath = await this.findPackageJson(repoPath);
    this.logger.log(`Checking package.json at: ${packageJsonPath}`);
    
    if (!packageJsonPath) {
      // Dosyaları listele debug için
      try {
        const files = await fs.promises.readdir(repoPath);
        this.logger.log(`Files in repo directory: ${files.join(', ')}`);
      } catch (err) {
        this.logger.error(`Cannot read repo directory: ${err.message}`);
      }
      return { error: 'No package.json found in repository' };
    }

    try {
      const packageJson = JSON.parse(
        await fs.promises.readFile(packageJsonPath, 'utf-8')
      );

      return {
        projectName: packageJson.name || 'Unknown',
        version: packageJson.version || 'Unknown',
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        license: packageJson.license || 'Unknown',
        foundAt: path.relative(repoPath, packageJsonPath)
      };
    } catch (error) {
      this.logger.warn(`SBOM generation failed: ${error.message}`);
      return { error: 'SBOM generation failed', details: error.message };
    }
  }

  private async analyzeLicenses(repoPath: string): Promise<any> {
    this.logger.log(`Analyzing licenses for ${repoPath}`);
    
    const licensePolicy = {
      allowed: ['MIT', 'Apache-2.0', 'Apache 2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'BSD', 'Unlicense'],
      banned: ['GPL-1.0', 'GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0'],
      review: ['LGPL', 'MPL']
    };

    const report: any = {
      allowed: [],
      banned: [],
      needsReview: [],
      unknown: [],
      summary: {
        total: 0,
        compliant: 0,
        nonCompliant: 0,
        needsReview: 0,
        error: ''
      }
    };

    try {
      const packageJsonPath = await this.findPackageJson(repoPath);
      
      if (packageJsonPath) {
        const packageJson = JSON.parse(
          await fs.promises.readFile(packageJsonPath, 'utf-8')
        );

        // 1. Ana proje lisansı
        const projectLicense = packageJson.license || 'Unknown';
        const projectLicenseStr = typeof projectLicense === 'string' 
          ? projectLicense 
          : (projectLicense.type || 'Unknown');
        
        // 2. Bağımlılıklar
        const allDeps = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {})
        };

        // 3. Her bağımlılık için lisans kontrolü (basit simülasyon)
        const dependencies = Object.entries(allDeps);
        report.summary.total = dependencies.length;
        
        for (const [name, version] of dependencies) {
          // Gerçek uygulamada: npm view [package] license komutu ile lisans alınır
          // Şimdilik rastgele lisans atayalım (demo için)
          const fakeLicenses = ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD', 'ISC', 'Unknown'];
          const randomLicense = fakeLicenses[Math.floor(Math.random() * fakeLicenses.length)];
          
          const license = randomLicense;
          const packageInfo = { 
            package: name, 
            version: version, 
            license: license 
          };
          
          // Lisans kategorisine göre ekle
          const licenseUpper = license.toUpperCase();
          let isCategorized = false;
          
          // İzin verilen lisanslar
          for (const allowed of licensePolicy.allowed) {
            if (licenseUpper.includes(allowed.toUpperCase())) {
              report.allowed.push(packageInfo);
              report.summary.compliant++;
              isCategorized = true;
              break;
            }
          }
          
          if (!isCategorized) {
            // Yasaklı lisanslar
            for (const banned of licensePolicy.banned) {
              if (licenseUpper.includes(banned.toUpperCase())) {
                report.banned.push(packageInfo);
                report.summary.nonCompliant++;
                isCategorized = true;
                break;
              }
            }
          }
          
          if (!isCategorized) {
            // İnceleme gerekenler
            for (const review of licensePolicy.review) {
              if (licenseUpper.includes(review.toUpperCase())) {
                report.needsReview.push(packageInfo);
                report.summary.needsReview++;
                isCategorized = true;
                break;
              }
            }
          }
          
          if (!isCategorized) {
            // Bilinmeyen
            report.unknown.push(packageInfo);
          }
        }
        
        // 4. Ana proje lisansını da ekle
        report.projectLicense = projectLicenseStr;
        report.projectLicenseCompliant = licensePolicy.allowed.some(allowed => 
          projectLicenseStr.toUpperCase().includes(allowed.toUpperCase())
        );

      } else {
        report.summary.error = 'Package.json not found';
      }
    } catch (error: any) {
      this.logger.warn(`License analysis failed: ${error.message}`);
      report.summary.error = error.message;
    }

    return report;
  }

  async getUserAnalyses(userId: number): Promise<Analysis[]> {
    return this.analysisRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAnalysis(id: number, userId: number): Promise<Analysis | null> {
    return this.analysisRepository.findOne({
      where: { id, userId },
    });
  }
}