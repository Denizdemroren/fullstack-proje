import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Analysis } from '../analysis/analysis.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @OneToMany(() => Product, (product: Product) => product.user)
  products: Product[];

  @OneToMany(() => Analysis, (analysis: Analysis) => analysis.user)
  analyses: Analysis[];
}