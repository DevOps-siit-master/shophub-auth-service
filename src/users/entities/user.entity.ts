import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { USER_ROLES, type UserRole } from '../../auth/auth.types';

/**
 * A registered ShopHub user.
 *
 * An account is identified by *either* an email/password pair *or* a Web3
 * wallet address (SIWE) — hence both sets of columns are nullable. Postgres
 * unique indexes allow multiple NULLs, so wallet-only and email-only users
 * coexist without collisions.
 */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Index({ unique: true })
  @Column({ name: 'wallet_address', type: 'varchar', nullable: true })
  walletAddress: string | null;

  @Column({
    type: 'varchar',
    nullable: false,
    default: 'shop_owner',
    enum: USER_ROLES,
  })
  role: UserRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
