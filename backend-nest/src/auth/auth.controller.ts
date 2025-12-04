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
  }) {
    const user = await this.authService.register({
      username: registerDto.username,
      password: registerDto.password,
    });
    
    return {
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
      },
    };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req, @Body() loginDto: { username: string; password: string }) {
    const result = await this.authService.login(req.user);
    
    return result;
  }
}