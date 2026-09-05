import * as Joi from 'joi';

/**
 * Validation schema for environment variables.
 */

const requiredForPostgres = {
  is: 'postgres',
  then: Joi.required(),
  otherwise: Joi.optional(),
};

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),

  // Database (PostgreSQL or REDIS)
  DATABASE_HOST: Joi.string().default('localhost'),
  DATABASE_PORT: Joi.number().default(5433),
  DATABASE_KIND: Joi.string().valid('postgres', 'redis').default('postgres'),
  DATABASE_USER: Joi.string().when('DATABASE_KIND', requiredForPostgres),
  DATABASE_NAME: Joi.string().when('DATABASE_KIND', requiredForPostgres),
  DATABASE_PASSWORD: Joi.string().when('DATABASE_KIND', requiredForPostgres),

  // JWT (email/password auth)
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),

  // Web3 SIWE — the domain/URI a signed SIWE message is validated against
  SIWE_DOMAIN: Joi.string().default('localhost:3000'),
  SIWE_URI: Joi.string().uri().default('http://localhost:3000'),
});
