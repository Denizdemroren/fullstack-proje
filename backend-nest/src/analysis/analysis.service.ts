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

  private async generateSBOM(repoPath: string): Promise<any> {
    this.logger.log(`Generating SBOM for ${repoPath}`);
    
    // Önce package.json var mı kontrol et
    const packageJsonPath = path.join(repoPath, 'package.json');
    this.logger.log(`Checking package.json at: ${packageJsonPath}`);
    
    if (!fs.existsSync(packageJsonPath)) {
      // Dosyaları listele debug için
      try {
        const files = await fs.promises.readdir(repoPath);
        this.logger.log(`Files in repo directory: ${files.join(', ')}`);
      } catch (err) {
        this.logger.error(`Cannot read repo directory: ${err.message}`);
      }
      return { error: 'No package.json found' };
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
      };
    } catch (error) {
      this.logger.warn(`SBOM generation failed: ${error.message}`);
      return { error: 'SBOM generation failed', details: error.message };
    }
  }

  private async analyzeLicenses(repoPath: string): Promise<any> {
    this.logger.log(`Analyzing licenses for ${repoPath}`);
    
    const licensePolicy = {
      allowed: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'],
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
      // package.json'dan bağımlılıkları oku
      const packageJsonPath = path.join(repoPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          await fs.promises.readFile(packageJsonPath, 'utf-8')
        );

        // Tüm bağımlılıkları birleştir
        const allDeps = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {})
        };

        report.summary.total = Object.keys(allDeps).length;
        
        // Basit analiz - her bağımlılık için varsayılan olarak "unknown"
        Object.entries(allDeps).forEach(([name, version]) => {
          // Gerçek uygulamada burada her paketin lisansını npm'den çekmen gerekir
          // Şimdilik basit tutalım
          report.unknown.push({ 
            package: name, 
            version: version, 
            license: 'UNKNOWN (not analyzed)' 
          });
        });

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
