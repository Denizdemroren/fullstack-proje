// backend-nestjs/src/auth/jwt.strategy.ts
// Gelen JWT token'larını doğrulamak ve kullanıcıyı çıkarmak için strateji

import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Token'ın nereden alınacağını belirtir (Authorization header'ından Bearer şeması ile)
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), 
      // Token'ın süresinin dolup dolmadığını otomatik kontrol et
      ignoreExpiration: false, 
      // Token'ı çözmek için kullanılan gizli anahtar (AuthModule'deki ile aynı olmalı)
      secretOrKey: 'SUPER_GUVENLI_GIZLI_ANAHTAR_123', 
    });
  }

  // Token başarıyla çözülür ve süresi dolmadıysa bu metod çalışır.
  // Payload, token içine gömdüğümüz veridir: { username, sub: userId }
  async validate(payload: any) {
    // Burada isterseniz kullanıcıyı veritabanından tekrar çekebilirsiniz,
    // ancak şimdilik sadece gerekli bilgileri döndürmek yeterli.
    return { userId: payload.sub, username: payload.username };
  }
}