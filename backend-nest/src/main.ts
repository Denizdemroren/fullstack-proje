import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // CORS ayarı burada çok önemlidir.
  // Docker'da localhost, local dev'de localhost:5173 olabilir
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: ['http://localhost', 'http://localhost:5173', 'http://127.0.0.1', 'http://127.0.0.1:5173'],
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true, // Eğer oturum çerezleri kullanacaksanız
    },
  });

  // 1. GÜVENLİK BAŞLIKLARI (HELMET) - ZAP Uyarılarını Çözmek İçin
  app.use(helmet({
    // X-Powered-By başlığını kaldırır (Vulnerability/Version Information Disclosure uyarısını çözer)
    hidePoweredBy: true,
    
    // Strict-Transport-Security (HSTS) başlığını ekler. 
    // Bu, HSTS uyarısını çözer (localhost'ta bile ZAP bunu ister).
    hsts: {
      maxAge: 31536000, // 1 yıl
      includeSubDomains: true,
      preload: true
    },

    // Content-Security-Policy (CSP) ayarı.
    // React/Vite ile uyumlu olacak şekilde ayarlandı.
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // Vite'ın Hot Reload (ws://localhost:*) bağlantılarına izin ver
            connectSrc: ["'self'", 'ws://localhost:*'],
            // Stil ve scriptler için 'unsafe-inline' development ortamında gerekebilir
            scriptSrc: ["'self'", "'unsafe-inline'"], 
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
        },
    }
  }));

  // Global ValidationPipe (iyi bir uygulama)
  app.useGlobalPipes(new ValidationPipe());

  await app.listen(3000);
}
bootstrap();