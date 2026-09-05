import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { SiweNonce } from '../auth/siwe/entities/siwe-nonce.entity';
import { NONCE_REPOSITORY } from '../auth/siwe/nonce-repository.adapter';
import { RedisNonceRepository } from '../auth/siwe/persistence/redis-nonce.repository';
import { TypeOrmNonceRepository } from '../auth/siwe/persistence/typeorm-nonce.repository';
import { buildDataSourceOptions } from '../database/typeorm-options';
import { User } from '../users/entities/user.entity';
import { RedisUserRepository } from '../users/persistence/redis-user.repository';
import { TypeOrmUserRepository } from '../users/persistence/typeorm-user.repository';
import { USER_REPOSITORY } from '../users/user-repository.adapter';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Module({})
export class PersistenceModule {
  static register(): DynamicModule {
    const kind = process.env.DATABASE_KIND ?? 'postgres';

    if (kind === 'redis') {
      return {
        module: PersistenceModule,
        global: true,
        providers: [
          {
            provide: REDIS_CLIENT,
            useFactory: () =>
              new Redis({
                host: process.env.DATABASE_HOST ?? 'localhost',
                port: parseInt(process.env.DATABASE_PORT ?? '6379', 10),
                password: process.env.DATABASE_PASSWORD || undefined,
              }),
          },
          {
            provide: USER_REPOSITORY,
            inject: [REDIS_CLIENT],
            useFactory: (redis: Redis) => new RedisUserRepository(redis),
          },
          {
            provide: NONCE_REPOSITORY,
            inject: [REDIS_CLIENT],
            useFactory: (redis: Redis) => new RedisNonceRepository(redis),
          },
        ],
        exports: [USER_REPOSITORY, NONCE_REPOSITORY],
      };
    }

    return {
      module: PersistenceModule,
      global: true,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) =>
            buildDataSourceOptions({
              DATABASE_HOST: config.getOrThrow<string>('DATABASE_HOST'),
              DATABASE_PORT: config.getOrThrow<number>('DATABASE_PORT'),
              DATABASE_USER: config.getOrThrow<string>('DATABASE_USER'),
              DATABASE_PASSWORD: config.getOrThrow<string>('DATABASE_PASSWORD'),
              DATABASE_NAME: config.getOrThrow<string>('DATABASE_NAME'),
            }),
        }),
        TypeOrmModule.forFeature([User, SiweNonce]),
      ],
      providers: [
        { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
        { provide: NONCE_REPOSITORY, useClass: TypeOrmNonceRepository },
      ],
      exports: [USER_REPOSITORY, NONCE_REPOSITORY],
    };
  }
}
