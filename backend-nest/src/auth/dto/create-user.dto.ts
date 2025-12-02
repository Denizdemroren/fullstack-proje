// backend-nestjs/src/auth/dto/create-user.dto.ts
// Kullanıcı kayıt isteği için DTO

import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Şifreniz en az 6 karakter olmalıdır.' }) // Şifre için minimum uzunluk zorunluluğu
  password: string;
}