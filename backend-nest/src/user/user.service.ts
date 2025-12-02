// backend-nest/src/user/user.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

// Yeni kullanıcı oluşturma için basit bir tip tanımı
interface CreateUserDto {
    username: string;
    password: string;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  // DÜZELTME: Dönüş tipi 'User | undefined' yerine 'User | null' yapıldı.
  // Çünkü TypeORM kayıt bulamazsa 'null' döner.
  async findOne(username: string): Promise<User | null> {
    // Veritabanından eşleşen kullanıcıyı döndürür
    return this.usersRepository.findOne({ where: { username } });
  }

  // Yeni kullanıcı oluşturma metodu
  async create(user: CreateUserDto): Promise<User> {
    // Yeni kullanıcı nesnesini oluştur ve kaydet (şifre hash'lenmiş olmalı)
    const newUser = this.usersRepository.create(user);
    return this.usersRepository.save(newUser);
  }
}