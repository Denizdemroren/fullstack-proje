// backend-nestjs/src/auth/dto/login-user.dto.ts
// Kullanıcı giriş isteği için DTO

import { IsNotEmpty, IsString } from 'class-validator';

export class LoginUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}