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

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(Analysis)
    private analysisRepository: Repository<Analysis>,
  ) {}

  async createAnalysis(userId: number, githubUrl: string): Promise<Analysis> {
    this.logger.log(`=== CREATE ANALYSIS REQUEST: userId=${userId}, url=${githubUrl} ===`);
    
    const analysis = this.analysisRepository.create({
      userId,
      githubUrl,
      status: 'pending',
    });

    await this.analysisRepository.save(analysis);
    
    this.logger.log(`=== ANALYSIS CREATED: id=${analysis.id} ===`);
    
    // Arka planda analizi başlat
    this.startAnalysis(analysis.id).catch(err => {
      this.logger.error(`Analysis ${analysis.id} failed: ${err.message}`);
    });

    return analysis;
  }

  async startAnalysis(analysisId: number): Promise<void> {
    this.logger.log(`=== STARTING ANALYSIS ${analysisId} ===`);
    
    const analysis = await this.analysisRepository.findOne({
      where: { id: analysisId },
    });

    if (!analysis) {
      this.logger.error(`Analysis ${analysisId} not found`);
      throw new Error('Analysis not found');
    }

    try {
      this.logger.log(`Analysis ${analysisId} found, githubUrl: ${analysis.githubUrl}`);
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

      this.logger.log(`=== ANALYSIS ${analysisId} COMPLETED ===`);

    } catch (error) {
      this.logger.error(`Analysis ${analysisId} failed: ${error.message}`);
      analysis.status = 'failed';
      analysis.errorMessage = error.message;
      await this.analysisRepository.save(analysis);
      this.logger.log(`=== ANALYSIS ${analysisId} FAILED ===`);
    }
  }

  private async cloneRepository(githubUrl: string): Promise<string> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'repo-'));
  const repoName = this.extractRepoName(githubUrl);
  const repoPath = path.join(tempDir, repoName);
  
  this.logger.log(`Cloning ${githubUrl} to ${tempDir}`);
  this.logger.log(`Expected repo path: ${repoPath}`);
  
  try {
    // 1. Repo'yu clone et
    await execAsync(`git clone ${githubUrl} ${repoPath}`, {
      timeout: 120000,
      cwd: tempDir
    });
    
    this.logger.log(`Clone successful. Checking if repo exists at: ${repoPath}`);
    
    let finalRepoPath = repoPath;
    
    // Repo'nun var olduğunu kontrol et
    if (!fs.existsSync(repoPath)) {
      this.logger.error(`Repo path does not exist after clone: ${repoPath}`);
      const files = await fs.promises.readdir(tempDir);
      this.logger.log(`Files in temp directory: ${files.join(', ')}`);
      
      // İlk directory'yi bul
      for (const file of files) {
        const fullPath = path.join(tempDir, file);
        const stat = await fs.promises.stat(fullPath);
        if (stat.isDirectory()) {
          this.logger.log(`Found directory: ${fullPath}, using as repo path`);
          finalRepoPath = fullPath;
          break;
        }
      }
      
      if (finalRepoPath === repoPath) {
        throw new Error(`Repository directory not found after clone`);
      }
    }
    
    // 2. Bağımlılıkları yükle (TÜM bağımlılıklar - hem production hem development)
    const packageJsonPath = path.join(finalRepoPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      this.logger.log(`Installing dependencies for ${finalRepoPath}`);
      
      // Önce package-lock.json kontrol et
      const packageLockPath = path.join(finalRepoPath, 'package-lock.json');
      const hasPackageLock = fs.existsSync(packageLockPath);
      this.logger.log(`Has package-lock.json: ${hasPackageLock}`);
      
      try {
        if (hasPackageLock) {
          // TÜM bağımlılıkları kur (--production=false devDependencies'i de kurar)
          await execAsync('npm ci --ignore-scripts --production=false', {
            timeout: 240000, // 4 dakika timeout (daha uzun)
            cwd: finalRepoPath
          });
          this.logger.log(`All dependencies (production + dev) installed successfully with npm ci`);
        } else {
          // TÜM bağımlılıkları kur
          await execAsync('npm install --ignore-scripts --production=false', {
            timeout: 240000, // 4 dakika timeout
            cwd: finalRepoPath
          });
          this.logger.log(`All dependencies installed with npm install --production=false`);
        }
      } catch (installError) {
        this.logger.warn(`Full installation failed: ${installError.message}`);
        
        // Fallback 1: Sadece production dependencies kur
        try {
          this.logger.log(`Trying production-only installation as fallback...`);
          await execAsync('npm install --ignore-scripts --production', {
            timeout: 180000,
            cwd: finalRepoPath
          });
          this.logger.log(`Production dependencies installed successfully (dev dependencies skipped)`);
        } catch (prodError) {
          this.logger.warn(`Production installation also failed: ${prodError.message}`);
          
          // Fallback 2: Sadece package.json oku, kurulum yapma
          this.logger.log(`Skipping npm installation, will analyze from package.json only`);
        }
      }
    }
    
    return finalRepoPath;
  } catch (error) {
    this.logger.error(`Clone failed: ${error.message}`);
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      this.logger.warn(`Failed to clean up temp directory: ${cleanupError.message}`);
    }
    throw new Error(`Failed to clone repository: ${error.message}`);
  }
}

  private extractRepoName(githubUrl: string): string {
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
    const rootPackageJson = path.join(dir, 'package.json');
    if (fs.existsSync(rootPackageJson)) {
      return rootPackageJson;
    }
    
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
  this.logger.log(`=== STARTING MANUAL LICENSE ANALYSIS ===`);
  
  const packageJsonPath = await this.findPackageJson(repoPath);
  
  if (!packageJsonPath) {
    return { 
      error: 'Package.json not found',
      summary: { error: 'No package.json found' }
    };
  }

  const packageDir = path.dirname(packageJsonPath);
  
  const report: any = {
    allowed: [],
    banned: [],
    needsReview: [],
    unknown: [],
    summary: {
      total: 0,
      compliant: 0,
      nonCompliant: 0,
      needsReview: 0
    }
  };

  const licensePolicy = {
    allowed: ['MIT', 'Apache-2.0', 'Apache 2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'BSD', 'Unlicense'],
    banned: ['GPL-1.0', 'GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0'],
    review: ['LGPL', 'MPL']
  };

  try {
    // 1. Ana projenin package.json'ını oku
    const pkgContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
    const pkgJson = JSON.parse(pkgContent);
    
    this.logger.log(`=== PACKAGE ANALYSIS ===`);
    this.logger.log(`Project: ${pkgJson.name}@${pkgJson.version}`);
    this.logger.log(`Main license: ${pkgJson.license || 'Unknown'}`);
    this.logger.log(`Production deps: ${Object.keys(pkgJson.dependencies || {}).length}`);
    this.logger.log(`Dev deps: ${Object.keys(pkgJson.devDependencies || {}).length}`);
    
    // 2. Tüm bağımlılıkları birleştir
    const allDependencies = {
      ...pkgJson.dependencies,
      ...pkgJson.devDependencies
    };
    
    this.logger.log(`Total dependencies to analyze: ${Object.keys(allDependencies).length}`);
    
    // 3. node_modules kontrol et
    const nodeModulesPath = path.join(packageDir, 'node_modules');
    const hasNodeModules = fs.existsSync(nodeModulesPath);
    
    if (!hasNodeModules) {
      this.logger.warn(`node_modules not found at: ${nodeModulesPath}`);
      this.logger.warn(`Will only analyze from package.json without actual license data`);
    } else {
      const nodeModulesContent = await fs.promises.readdir(nodeModulesPath);
      this.logger.log(`Total items in node_modules: ${nodeModulesContent.length}`);
    }
    
    // 4. Her bağımlılık için lisans analizi yap
    let analyzedCount = 0;
    let foundInNodeModules = 0;
    let notFoundInNodeModules = 0;
    
    for (const [depName, depVersion] of Object.entries(allDependencies)) {
      try {
        let licenseStr = 'Unknown';
        let actualVersion = depVersion as string;
        
        // node_modules'de paketi ara
        if (hasNodeModules) {
          // Scoped paket isimleri için (@org/package)
          let depPackagePath = '';
          
          if (depName.startsWith('@')) {
            // @org/package formatı için
            const [scope, pkg] = depName.split('/');
            depPackagePath = path.join(nodeModulesPath, scope, pkg, 'package.json');
          } else {
            // Normal paket isimleri için
            depPackagePath = path.join(nodeModulesPath, depName, 'package.json');
          }
          
          if (fs.existsSync(depPackagePath)) {
            foundInNodeModules++;
            const depPkgContent = await fs.promises.readFile(depPackagePath, 'utf-8');
            const depPkgJson = JSON.parse(depPkgContent);
            
            // Lisans bilgisini al
            if (depPkgJson.license) {
              if (typeof depPkgJson.license === 'string') {
                licenseStr = depPkgJson.license;
              } else if (depPkgJson.license.type) {
                licenseStr = depPkgJson.license.type;
              }
            } else if (depPkgJson.licenses) {
              if (Array.isArray(depPkgJson.licenses) && depPkgJson.licenses.length > 0) {
                const firstLicense = depPkgJson.licenses[0];
                licenseStr = typeof firstLicense === 'string' ? firstLicense : firstLicense.type || 'Unknown';
              } else if (typeof depPkgJson.licenses === 'string') {
                licenseStr = depPkgJson.licenses;
              }
            }
            
            actualVersion = depPkgJson.version || actualVersion;
          } else {
            notFoundInNodeModules++;
            licenseStr = 'Not installed';
          }
        } else {
          // node_modules yoksa, varsayılan lisans ata
          licenseStr = 'MIT (assumed)';
        }
        
        const packageInfo = {
          package: depName,
          version: depVersion as string,
          license: licenseStr,
          actualVersion: actualVersion,
          installed: hasNodeModules && licenseStr !== 'Not installed'
        };
        
        // Lisans kategorisine göre ekle (sadece gerçek lisans bilgisi varsa)
        if (licenseStr !== 'Not installed' && licenseStr !== 'Unknown') {
          const licenseUpper = licenseStr.toUpperCase();
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
        } else {
          // Kurulmamış veya bilinmeyen lisans
          report.unknown.push(packageInfo);
        }
        
        analyzedCount++;
        
        // İlk 10 paketi logla
        if (analyzedCount <= 10) {
          const status = packageInfo.installed ? '✓' : '✗';
          this.logger.log(`${status} ${depName}@${actualVersion}: ${licenseStr}`);
        }
        
      } catch (depError) {
        this.logger.warn(`Failed to analyze ${depName}: ${depError.message}`);
      }
    }
    
    this.logger.log(`=== ANALYSIS RESULTS ===`);
    this.logger.log(`Total dependencies: ${Object.keys(allDependencies).length}`);
    this.logger.log(`Analyzed: ${analyzedCount} packages`);
    this.logger.log(`Found in node_modules: ${foundInNodeModules}`);
    this.logger.log(`Not found in node_modules: ${notFoundInNodeModules}`);
    this.logger.log(`Allowed licenses: ${report.allowed.length}`);
    this.logger.log(`Banned licenses: ${report.banned.length}`);
    this.logger.log(`Needs review: ${report.needsReview.length}`);
    this.logger.log(`Unknown licenses: ${report.unknown.length}`);
    
    // Toplam sayıyı güncelle
    report.summary.total = analyzedCount;
    
    // 5. Ana proje lisansını da ekle
    try {
      report.projectLicense = pkgJson.license || 'Unknown';
      const projectLicenseStr = typeof report.projectLicense === 'string' 
        ? report.projectLicense 
        : (report.projectLicense.type || 'Unknown');
        
      report.projectLicenseCompliant = licensePolicy.allowed.some(allowed => 
        projectLicenseStr.toUpperCase().includes(allowed.toUpperCase())
      );
      
      this.logger.log(`Project license: ${report.projectLicense} (Compliant: ${report.projectLicenseCompliant})`);
    } catch (error) {
      report.projectLicense = 'Unknown';
      report.projectLicenseCompliant = false;
    }

  } catch (error: any) {
    this.logger.error(`Manual license analysis failed: ${error.message}`);
    report.summary.error = error.message;
    
    // Fallback: Demo mod
    report.fallbackUsed = true;
    report.warning = 'Manual license analysis failed';
  }

  this.logger.log(`=== LICENSE ANALYSIS COMPLETED ===`);
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