import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { SiweNonce } from '../entities/siwe-nonce.entity';
import { NonceRepository } from '../nonce-repository.adapter';

@Injectable()
export class TypeOrmNonceRepository implements NonceRepository {
  constructor(
    @InjectRepository(SiweNonce) private readonly nonces: Repository<SiweNonce>,
  ) {}

  async issue(nonce: string, ttlMs: number): Promise<void> {
    await this.nonces.delete({ expiresAt: LessThan(new Date()) });
    await this.nonces.save(
      this.nonces.create({ nonce, expiresAt: new Date(Date.now() + ttlMs) }),
    );
  }

  async consume(nonce: string): Promise<boolean> {
    const stored = await this.nonces.findOne({ where: { nonce } });
    await this.nonces.delete({ nonce });
    return !!stored && stored.expiresAt.getTime() >= Date.now();
  }
}
