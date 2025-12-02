import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS - Production için tüm gerekli origin'leri ekle
  app.enableCors({
    origin: [
      'http://localhost',
      'http://localhost:5173', 
      'http://127.0.0.1',
      'http://127.0.0.1:5173',
      'https://backend-nest-msnd.onrender.com',
      'https://frontend-react-xoq2.onrender.com', // FRONTEND URL'İN
      /\.onrender\.com$/, // Tüm Render domain'lerine izin ver
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Helmet Security (CSP devre dışı)
  app.use(
    helmet({
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      contentSecurityPolicy: false, // CSP'yi devre dışı bırak
    }),
  );

  // Global ValidationPipe
  app.useGlobalPipes(new ValidationPipe());

  // PORT environment variable'dan al
  const port = process.env.PORT || 3000;
  
  await app.listen(port);
  console.log(`🚀 Application is running on port ${port}`);
}

bootstrap();