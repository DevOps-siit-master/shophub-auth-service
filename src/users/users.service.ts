import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { type UserRole } from '../auth/auth.types';
import { User } from './entities/user.entity';
import {
  USER_REPOSITORY,
  type UserRepository,
} from './user-repository.adapter';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  role: UserRole;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly usersRepository: UserRepository,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.usersRepository.findByWalletAddress(
      this.normalizeWallet(walletAddress),
    );
  }

  /**
   * Resolves the wallet-only account for a SIWE sign-in, creating it on first
   * login. Idempotent: concurrent first logins converge on the same row.
   */
  async findOrCreateByWallet(walletAddress: string): Promise<User> {
    const normalized = this.normalizeWallet(walletAddress);
    return this.usersRepository.findOrCreateByWallet(normalized);
  }

  async create(data: CreateUserData): Promise<User> {
    const email = this.normalizeEmail(data.email);

    const user = await this.usersRepository.createWithEmail({
      ...data,
      email: email,
    });
    if (!user) {
      throw new ConflictException('A user with this email already exists');
    }
    return user;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeWallet(walletAddress: string): string {
    return walletAddress.trim().toLowerCase();
  }
}
