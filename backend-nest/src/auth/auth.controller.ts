// backend-nestjs/src/auth/auth.controller.ts
// Kayıt ve Giriş API uç noktaları

import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LocalAuthGuard } from './local-auth.guard'; // Local Auth Guard'ı içe aktar
import { LoginUserDto } from './dto/login-user.dto';

@Controller('auth') // Tüm uç noktalar '/auth' ile başlar
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /auth/register
  // Yeni kullanıcı kaydı oluşturur
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.authService.register(createUserDto);
    // Şifreyi göstermemek için hassas verileri temizle
    const { password, ...result } = user; 
    return {
        message: 'Kullanıcı kaydı başarıyla oluşturuldu.',
        user: result,
    };
  }

  // POST /auth/login
  // LocalAuthGuard, kimlik doğrulamasını tetikler. Başarılı olursa,
  // kullanıcının şifresiz bilgisi req.user nesnesine eklenir.
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Body() loginUserDto: LoginUserDto) {
    // AuthService.login() metodu, req.user'daki bilgiyi alıp JWT üretir.
    return this.authService.login(req.user);
  }
}

