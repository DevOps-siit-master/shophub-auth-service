import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

/**
 * Database connection settings, resolved from validated environment values.
 * Shared by the Nest runtime (AppModule) and the TypeORM CLI (data-source.ts)
 * so both always use the exact same schema/migration configuration.
 */
export interface DatabaseEnv {
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
}

export function buildDataSourceOptions(env: DatabaseEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
    migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
    // Migrations are the single source of truth — never auto-sync the schema.
    synchronize: false,
    migrationsRun: false,
  };
}
