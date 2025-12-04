import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../user/user.entity';

@Entity()
export class Analysis {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, user => user.analyses)
  user: User;

  @Column()
  userId: number;

  @Column()
  githubUrl: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @Column('jsonb', { nullable: true })
  sbomData: any;

  @Column('jsonb', { nullable: true })
  licenseReport: any;

  @Column('jsonb', { nullable: true })
  vulnerabilities: any;

  @Column('text', { nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
