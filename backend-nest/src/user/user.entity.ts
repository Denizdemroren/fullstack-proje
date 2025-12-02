// backend-nestjs/src/user/user.entity.ts

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true }) // Kullanıcı adının tekil olmasını sağlıyoruz
  username: string;

  @Column() // Şifrenin şifrelenmiş halini tutacak
  password: string; 

  // Kullanıcı tablosuna eklenebilecek ek alanlar (isteğe bağlı)
  @Column({ default: true })
  isActive: boolean;
}