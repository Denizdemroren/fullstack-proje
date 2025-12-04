import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    // username'i email olarak kullan (frontend'den username geliyor)
    const user = await this.authService.register({
      email: registerDto.username,
      password: registerDto.password,
      firstName: registerDto.firstName || registerDto.username,
      lastName: registerDto.lastName || '',
    });
    
    return {
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.email, // frontend'e username olarak email dön
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Body() loginDto: { username: string; password: string }) {
    const result = await this.authService.login(req.user);
    
    // Frontend'e username olarak email dön
    return {
      ...result,
      user: {
        ...result.user,
        username: result.user.email,
      }
    };
  }
}
