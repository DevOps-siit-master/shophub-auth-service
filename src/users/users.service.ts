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
}
