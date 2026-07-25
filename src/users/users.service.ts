import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

export interface CreateUserData {
  email: string;
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: this.normalizeEmail(email) },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { walletAddress: this.normalizeWallet(walletAddress) },
    });
  }

  /**
   * Resolves the wallet-only account for a SIWE sign-in, creating it on first
   * login. Idempotent: concurrent first logins converge on the same row.
   */
  async findOrCreateByWallet(walletAddress: string): Promise<User> {
    const normalized = this.normalizeWallet(walletAddress);

    const existing = await this.findByWalletAddress(normalized);
    if (existing) {
      return existing;
    }

    try {
      const user = this.usersRepository.create({ walletAddress: normalized });
      return await this.usersRepository.save(user);
    } catch {
      // Lost a race against a concurrent first login — the row now exists.
      const user = await this.findByWalletAddress(normalized);
      if (!user) {
        throw new ConflictException('Could not create wallet account');
      }
      return user;
    }
  }

  async create(data: CreateUserData): Promise<User> {
    const email = this.normalizeEmail(data.email);

    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const user = this.usersRepository.create({
      email,
      passwordHash: data.passwordHash,
    });
    return this.usersRepository.save(user);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeWallet(walletAddress: string): string {
    return walletAddress.trim().toLowerCase();
  }
}
