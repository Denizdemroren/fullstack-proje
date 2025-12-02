// backend-nest/src/products/entities/product.entity.ts

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/user.entity';

@Entity('products') // Bu, veritabanındaki tablo adımızdır.
export class Product {
  
  // PRIMARY KEY, otomatik artan sayı
  @PrimaryGeneratedColumn()
  id: number;

  // Ürün Adı (Metin türü)
  @Column()
  name: string;

  // Ürün Fiyatı (Ondalıklı sayı türü için 'numeric' kullanırız)
  @Column('numeric')
  price: number;

  // Ürünü oluşturan kullanıcı
  @Column({ nullable: true })
  userId: number;

  // Kullanıcı ile ilişki
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}