// backend-nestjs/src/auth/auth.service.ts
// Kullanıcı Kaydı, Girişi ve Şifre Kontrol Mantığı

import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { User } from '../user/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  // 1. Şifreyi Karşılaştırma Fonksiyonu
  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.userService.findOne(username);
    
    // Kullanıcı mevcut değilse
    if (!user) {
      return null;
    }
    
    // Şifreleri karşılaştır (bcrypt ile)
    const isMatch = await bcrypt.compare(pass, user.password);

    if (user && isMatch) {
      // Şifre doğruysa, şifre hariç kullanıcı bilgisini döndür
      const { password, ...result } = user;
      return result;
    }
    
    return null;
  }

  // 2. Kullanıcı Kayıt Fonksiyonu
  async register(userDto: CreateUserDto): Promise<User> {
    // 1. Kullanıcı adının zaten kullanılıp kullanılmadığını kontrol et
    const existingUser = await this.userService.findOne(userDto.username);
    if (existingUser) {
        throw new BadRequestException('Bu kullanıcı adı zaten kullanılıyor.');
    }

    // 2. Şifreyi hash'le (şifrele) - Güvenlik için en kritik adım
    const hashedPassword = await bcrypt.hash(userDto.password, 10); // 10, şifreleme maliyetidir.

    // 3. Yeni kullanıcıyı oluştur ve kaydet
    const newUser = await this.userService.create({
      username: userDto.username,
      password: hashedPassword, // Hash'lenmiş şifreyi kaydet
    });
    
    return newUser;
  }
  
  // 3. Kullanıcı Giriş Fonksiyonu (Token Üretimi)
  async login(user: any) {
    // Passport tarafından doğrulanmış kullanıcı bilgisi gelir.
    
    // JWT içinde saklanacak veriyi hazırla (payload)
    const payload = { username: user.username, sub: user.id };
    
    return {
      // Access Token oluştur ve döndür
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
      }
    };
  }
}