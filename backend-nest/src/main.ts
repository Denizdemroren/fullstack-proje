import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS ayarları - hem local hem Render frontend
  app.enableCors({
    origin: [
      'http://localhost:5173', // Vite default port (local)
      'https://frontend-react-xoq2.onrender.com', // Render frontend URL
    ],
    credentials: true,
  });
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
}
bootstrap();