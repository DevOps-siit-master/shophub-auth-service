import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { NonceRepository } from '../nonce-repository.adapter';

const key = (nonce: string) => `nonce:${nonce}`;

@Injectable()
export class RedisNonceRepository implements NonceRepository {
  constructor(private readonly redis: Redis) {}

  async issue(nonce: string, ttlMs: number): Promise<void> {
    // NX so a collision can't silently overwrite; PX auto-expires it.
    await this.redis.set(key(nonce), '1', 'PX', ttlMs, 'NX');
  }

  async consume(nonce: string): Promise<boolean> {
    // GETDEL = atomic single-use; TTL already removed anything expired.
    const v = await this.redis.getdel(key(nonce));
    return v !== null;
  }
}
