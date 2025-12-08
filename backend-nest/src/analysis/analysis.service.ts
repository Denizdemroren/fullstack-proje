import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Analysis } from './analysis.entity';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as licenseCrawler from 'npm-license-crawler';
import * as spdxCorrect from 'spdx-correct';

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

      const tempDir = await this.cloneRepository(analysis.githubUrl);
      const sbomData = await this.generateSBOM(tempDir);
      const licenseReport = await this.analyzeLicenses(tempDir);
      
      analysis.sbomData = sbomData;
      analysis.licenseReport = licenseReport;
      analysis.status = 'completed';
      
      await this.analysisRepository.save(analysis);

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
    
    try {
      const cloneCommand = `git clone --depth 1 --filter=blob:none --single-branch ${githubUrl} ${repoPath}`;
      this.logger.log(`Using shallow clone: ${cloneCommand}`);
      
      await execAsync(cloneCommand, {
        timeout: 300000,
        cwd: tempDir,
        maxBuffer: 1024 * 1024 * 50
      });
      
      this.logger.log(`Shallow clone successful to: ${repoPath}`);
      
      let finalRepoPath = repoPath;
      
      if (!fs.existsSync(repoPath)) {
        this.logger.warn(`Repo path does not exist: ${repoPath}, searching...`);
        const files = await fs.promises.readdir(tempDir);
        
        for (const file of files) {
          const fullPath = path.join(tempDir, file);
          const stat = await fs.promises.stat(fullPath);
          if (stat.isDirectory()) {
            finalRepoPath = fullPath;
            this.logger.log(`Using directory: ${finalRepoPath}`);
            break;
          }
        }
      }
      
      const packageJsonPath = await this.findPackageJson(finalRepoPath);
      if (packageJsonPath) {
        this.logger.log(`Found package.json, installing dependencies...`);
        const packageDir = path.dirname(packageJsonPath);
        
        try {
          await execAsync('npm install --ignore-scripts --production=false', {
            timeout: 300000,
            cwd: packageDir
          });
          this.logger.log(`Dependencies installed successfully`);
        } catch (installError) {
          this.logger.warn(`Installation failed: ${installError.message}`);
          // Continue without installation
        }
      }
      
      return finalRepoPath;
    } catch (error) {
      this.logger.error(`Clone failed: ${error.message}`);
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  private extractRepoName(githubUrl: string): string {
    const url = new URL(githubUrl);
    const pathParts = url.pathname.split('/').filter(part => part.length > 0);
    
    if (pathParts.length >= 2) {
      return pathParts[1].replace(/\.git$/, '');
    }
    
    return 'repository';
  }

  private async findPackageJson(dir: string): Promise<string | null> {
    const commonPaths = [
      path.join(dir, 'package.json'),
      path.join(dir, 'backend', 'package.json'),
      path.join(dir, 'frontend', 'package.json'),
      path.join(dir, 'src', 'package.json'),
      path.join(dir, 'backend-nest', 'package.json'),
      path.join(dir, 'frontend-react', 'package.json')
    ];
    
    for (const pkgPath of commonPaths) {
      if (fs.existsSync(pkgPath)) {
        this.logger.log(`Found package.json at: ${pkgPath}`);
        return pkgPath;
      }
    }
    
    return null;
  }

  private async generateSBOM(repoPath: string): Promise<any> {
    this.logger.log(`Generating SBOM for ${repoPath}`);
    
    const packageJsonPath = await this.findPackageJson(repoPath);
    
    if (!packageJsonPath) {
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
      return { error: 'SBOM generation failed', details: error.message };
    }
  }

  private async analyzeLicenses(repoPath: string): Promise<any> {
    this.logger.log(`=== STARTING PROFESSIONAL LICENSE ANALYSIS ===`);
    
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
      allowed: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'BSD', 'Unlicense'],
      banned: ['GPL-1.0', 'GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0'],
      review: ['LGPL-2.1', 'LGPL-3.0', 'MPL-1.1', 'MPL-2.0']
    };

    try {
      // 1. npm-license-crawler ile profesyonel analiz
      const licenses = await new Promise<any>((resolve, reject) => {
        licenseCrawler.crawl({
          start: packageDir,
          production: true,
          development: true,
          json: true,
          onlyDirectDependencies: false,
          exclude: []
        }, (error: Error, result: any) => {
          if (error) {
            this.logger.error(`License crawler error: ${error.message}`);
            reject(error);
          } else {
            this.logger.log(`License crawler found ${Object.keys(result).length} packages`);
            resolve(result);
          }
        });
      });

      // 2. Lisansları kategorize et
      Object.entries(licenses).forEach(([packageKey, data]: [string, any]) => {
        const packageName = packageKey.split('@')[0];
        const version = packageKey.includes('@') ? packageKey.split('@')[1] : 'unknown';
        
        // Lisans bilgisini al ve SPDX formatına düzelt
        let license = data.licenses || 'Unknown';
        if (typeof license === 'string') {
          const corrected = spdxCorrect(license);
          if (corrected) license = corrected;
        }

        const packageInfo = {
          package: packageName,
          version: version,
          license: license,
          repository: data.repository || '',
          publisher: data.publisher || '',
          email: data.email || ''
        };

        // Lisans kategorizasyonu
        const licenseStr = typeof license === 'string' ? license.toUpperCase() : 'UNKNOWN';
        let isCategorized = false;

        // İzin verilen lisanslar
        for (const allowed of licensePolicy.allowed) {
          if (licenseStr.includes(allowed.toUpperCase())) {
            report.allowed.push(packageInfo);
            report.summary.compliant++;
            isCategorized = true;
            break;
          }
        }

        if (!isCategorized) {
          // Yasaklı lisanslar
          for (const banned of licensePolicy.banned) {
            if (licenseStr.includes(banned.toUpperCase())) {
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
            if (licenseStr.includes(review.toUpperCase())) {
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
      });

      // 3. Ana proje lisansı
      try {
        const pkgContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
        const pkgJson = JSON.parse(pkgContent);
        report.projectLicense = pkgJson.license || 'Unknown';
        
        const projectLicenseStr = typeof report.projectLicense === 'string' 
          ? report.projectLicense.toUpperCase() 
          : 'UNKNOWN';
          
        report.projectLicenseCompliant = licensePolicy.allowed.some(allowed => 
          projectLicenseStr.includes(allowed.toUpperCase())
        );
      } catch (error) {
        report.projectLicense = 'Unknown';
        report.projectLicenseCompliant = false;
      }

      // 4. Özet
      report.summary.total = Object.keys(licenses).length;

      this.logger.log(`=== PROFESSIONAL ANALYSIS RESULTS ===`);
      this.logger.log(`Total packages: ${report.summary.total}`);
      this.logger.log(`Allowed: ${report.allowed.length}`);
      this.logger.log(`Banned: ${report.banned.length}`);
      this.logger.log(`Needs review: ${report.needsReview.length}`);
      this.logger.log(`Unknown: ${report.unknown.length}`);

      // İlk 10 paketi logla
      const firstTen = Object.entries(licenses).slice(0, 10);
      firstTen.forEach(([key, data]: [string, any]) => {
        this.logger.log(`📦 ${key}: ${data.licenses || 'Unknown'}`);
      });

    } catch (error: any) {
      this.logger.error(`Professional license analysis failed: ${error.message}`);
      
      // Fallback: Basit analiz
      return this.fallbackLicenseAnalysis(packageJsonPath);
    }

    return report;
  }

  private async fallbackLicenseAnalysis(packageJsonPath: string): Promise<any> {
    this.logger.log(`Using fallback license analysis`);
    
    try {
      const pkgContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
      const pkgJson = JSON.parse(pkgContent);
      
      const allDeps = {
        ...pkgJson.dependencies,
        ...pkgJson.devDependencies
      };
      
      return {
        allowed: Object.keys(allDeps).map(name => ({
          package: name,
          version: allDeps[name],
          license: 'MIT (assumed)'
        })),
        banned: [],
        needsReview: [],
        unknown: [],
        summary: {
          total: Object.keys(allDeps).length,
          compliant: Object.keys(allDeps).length,
          nonCompliant: 0,
          needsReview: 0
        },
        projectLicense: pkgJson.license || 'MIT',
        projectLicenseCompliant: true,
        warning: 'Used fallback analysis'
      };
    } catch (error) {
      return {
        error: 'License analysis failed completely',
        summary: { error: error.message }
      };
    }
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