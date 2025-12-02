// backend-nestjs/src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from './local.strategy'; 
import { LocalAuthGuard } from './local-auth.guard';
import { JwtStrategy } from './jwt.strategy'; // <-- Yeni import
import { JwtAuthGuard } from './jwt-auth.guard'; // <-- Yeni import

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({
      // JWT Secret Key (AuthService ve JwtStrategy'deki ile aynı olmalı)
      secret: 'SUPER_GUVENLI_GIZLI_ANAHTAR_123', 
      signOptions: { expiresIn: '3600s' }, 
    }),
  ],
  controllers: [AuthController],
  // JWT Strategy ve Guard'ı provider'lara ekliyoruz
  providers: [
    AuthService, 
    LocalStrategy, 
    LocalAuthGuard, 
    JwtStrategy, // <-- Eklendi
    JwtAuthGuard // <-- Eklendi
  ], 
  exports: [AuthService, JwtModule, JwtAuthGuard], // JwtAuthGuard'ı koruma için dışa aktarıyoruz
})
export class AuthModule {}