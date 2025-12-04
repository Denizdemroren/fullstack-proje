import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProductsModule } from './products/products.module';
import { Product } from './products/entities/product.entity';
import { UserModule } from './user/user.module';
import { User } from './user/user.entity';
import { AuthModule } from './auth/auth.module';
import { AnalysisModule } from './analysis/analysis.module';
import { Analysis } from './analysis/analysis.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Öncelikle DATABASE_URL'yi kontrol et
        const databaseUrl = configService.get('DATABASE_URL');
        
        if (databaseUrl) {
          // DATABASE_URL varsa parse et
          const url = new URL(databaseUrl.replace('postgresql://', 'http://'));
          
          return {
            type: 'postgres',
            host: url.hostname,
            port: parseInt(url.port),
            username: url.username,
            password: url.password,
            database: url.pathname.replace('/', ''),
            entities: [Product, User, Analysis],
            synchronize: false,
            autoLoadEntities: true,
            ssl: true,
            extra: {
              ssl: {
                rejectUnauthorized: false,
              },
            },
          };
        } else {
          // Yoksa ayrı ayrı değişkenleri kullan (local için)
          return {
            type: 'postgres',
            host: configService.get('DB_HOST'),
            port: configService.get<number>('DB_PORT'),
            username: configService.get('DB_USER'),
            password: configService.get('DB_PASSWORD'),
            database: configService.get('DB_NAME'),
            entities: [Product, User, Analysis],
            synchronize: false,
            autoLoadEntities: true,
            ssl: configService.get('NODE_ENV') === 'production',
            extra: configService.get('NODE_ENV') === 'production' ? {
              ssl: {
                rejectUnauthorized: false,
              },
            } : {},
          };
        }
      },
      inject: [ConfigService],
    }),
    ProductsModule,
    UserModule,
    AuthModule,
    AnalysisModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}