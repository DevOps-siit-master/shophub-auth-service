import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { type UserRole } from '../../auth/auth.types';
import { User } from '../entities/user.entity';
import { CreateUserData, UserRepository } from '../user-repository.adapter';

const userKey = (id: string) => `user:${id}`;
const emailKey = (email: string) => `useremail:${email}`;
const walletKey = (addr: string) => `userwallet:${addr}`;

// Reserve the email index and write the user hash in one atomic step.
// KEYS[1]=useremail:{email}  KEYS[2]=user:{id}
// ARGV[1]=id  ARGV[2..]=HSET field/value pairs
// returns 0 if the email is already taken, 1 on success.
const RESERVE_EMAIL_LUA = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('HSET', KEYS[2], unpack(ARGV, 2))
return 1`;

// Get-or-create by wallet, atomically. Returns the resolved user id.
// KEYS[1]=userwallet:{addr}  KEYS[2]=user:{id}  ARGV as above.
const GET_OR_CREATE_WALLET_LUA = `
local existing = redis.call('GET', KEYS[1])
if existing then return existing end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('HSET', KEYS[2], unpack(ARGV, 2))
return ARGV[1]`;

@Injectable()
export class RedisUserRepository implements UserRepository {
  constructor(private readonly redis: Redis) {}

  private toUser(h: Record<string, string>): User {
    return {
      id: h.id,
      email: h.email ?? null,
      passwordHash: h.passwordHash ?? null,
      walletAddress: h.walletAddress ?? null,
      role: h.role as UserRole,
      createdAt: new Date(h.createdAt),
      updatedAt: new Date(h.updatedAt),
    };
  }

  private async hydrate(id: string | null): Promise<User | null> {
    if (!id) return null;
    const h = await this.redis.hgetall(userKey(id));
    return Object.keys(h).length ? this.toUser(h) : null;
  }

  findById(id: string): Promise<User | null> {
    return this.hydrate(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.hydrate(await this.redis.get(emailKey(email)));
  }

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.hydrate(await this.redis.get(walletKey(walletAddress)));
  }

  async createWithEmail(data: CreateUserData): Promise<User | null> {
    const id = randomUUID();
    const iso = new Date().toISOString();
    const res = (await this.redis.eval(
      RESERVE_EMAIL_LUA,
      2,
      emailKey(data.email),
      userKey(id),
      id,
      'id',
      id,
      'email',
      data.email,
      'passwordHash',
      data.passwordHash,
      'role',
      data.role,
      'createdAt',
      iso,
      'updatedAt',
      iso,
    )) as number;
    if (res === 0) return null;
    return this.toUser({
      id,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      createdAt: iso,
      updatedAt: iso,
    });
  }

  async findOrCreateByWallet(walletAddress: string): Promise<User> {
    const id = randomUUID();
    const iso = new Date().toISOString();
    const resolvedId = (await this.redis.eval(
      GET_OR_CREATE_WALLET_LUA,
      2,
      walletKey(walletAddress),
      userKey(id),
      id,
      'id',
      id,
      'walletAddress',
      walletAddress,
      'role',
      'shop_owner',
      'createdAt',
      iso,
      'updatedAt',
      iso,
    )) as string;
    const user = await this.hydrate(resolvedId);
    if (!user) throw new Error('Could not create wallet account');
    return user;
  }
}
