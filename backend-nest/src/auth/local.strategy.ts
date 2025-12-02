// backend-nestjs/src/auth/local.strategy.ts
// Kullanıcı adı ve şifre ile kimlik doğrulamayı yönetecek Passport stratejisi

import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super(); // LocalStrategy'nin varsayılan ayarlarını kullanır
  }

  // Passport, kullanıcı adı ve şifreyi (username ve password) buraya gönderir.
  async validate(username: string, password: string): Promise<any> {
    // AuthService'deki şifre karşılaştırma mantığını çağırır.
    const user = await this.authService.validateUser(username, password);
    
    // Doğrulama başarısızsa
    if (!user) {
      throw new UnauthorizedException('Kullanıcı adı veya şifre hatalı.');
    }
    
    // Doğrulama başarılıysa (şifre hariç) kullanıcı bilgisini döndürür.
    return user;
  }
}