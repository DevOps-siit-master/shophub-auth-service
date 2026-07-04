import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './typeorm-options';

// Standalone DataSource used by the TypeORM CLI (migration:generate/run/revert).
// The Nest app builds its options from ConfigService instead (see AppModule).
loadEnv();

const dataSource = new DataSource(
  buildDataSourceOptions({
    DATABASE_HOST: process.env.DATABASE_HOST ?? 'localhost',
    DATABASE_PORT: Number(process.env.DATABASE_PORT ?? '5433'),
    DATABASE_USER: process.env.DATABASE_USER ?? 'shophub',
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD ?? 'shophub',
    DATABASE_NAME: process.env.DATABASE_NAME ?? 'shophub_auth',
  }),
);

export default dataSource;
