// backend-nestjs/src/user/user.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { User } from './user.entity'; // User Entity'sini içe aktar

@Module({
  imports: [TypeOrmModule.forFeature([User])], // TypeORM'a User entity'sini tanıtıyoruz
  providers: [UserService],
  exports: [UserService], // Auth modülünün bu servisi kullanabilmesi için dışa aktarıyoruz
})
export class UserModule {}