import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { CreateUserData, UserRepository } from '../user-repository.adapter';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } });
  }

  findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.users.findOne({ where: { walletAddress } });
  }

  async createWithEmail(data: CreateUserData): Promise<User | null> {
    const existing = await this.users.findOne({ where: { email: data.email } });
    if (existing) return null;
    return this.users.save(this.users.create(data));
  }

  async findOrCreateByWallet(walletAddress: string): Promise<User> {
    const existing = await this.users.findOne({ where: { walletAddress } });
    if (existing) return existing;
    try {
      return await this.users.save(this.users.create({ walletAddress }));
    } catch {
      const user = await this.users.findOne({ where: { walletAddress } });
      if (!user) throw new Error('Could not create wallet account');
      return user;
    }
  }
}
