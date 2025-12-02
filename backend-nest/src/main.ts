import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS - Production için daha esnek yap
  app.enableCors({
    origin: [
      'http://localhost',
      'http://localhost:5173', 
      'http://127.0.0.1',
      'http://127.0.0.1:5173',
      'https://fullstack-proje.onrender.com', // Render frontend URL'in (sonra ekleyeceğiz)
      /\.onrender\.com$/, // Tüm Render domain'lerine izin ver
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Helmet Security
  app.use(
    helmet({
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", 'ws://localhost:*'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
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