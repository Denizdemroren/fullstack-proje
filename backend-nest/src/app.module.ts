// backend-nest/src/app.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './products/products.module';
import { Product } from './products/entities/product.entity'; // Product entity yolunu kontrol edin
import { UserModule } from './user/user.module';
import { User } from './user/user.entity'; // User entity'sini import et
import { AuthModule } from './auth/auth.module'; // Auth modülünü import et

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'user',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'mydatabase',
      entities: [Product, User], // Entity'leri buraya ekliyoruz
      synchronize: true,     // Geliştirme ortamı için tablo senkronizasyonu
      autoLoadEntities: true, // Modüllerden entity'leri otomatik yüklemeyi de açıyoruz
    }),
    ProductsModule,
    UserModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}