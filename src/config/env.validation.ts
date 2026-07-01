import * as Joi from 'joi';

/**
 * Validation schema for environment variables.
 * Extended in later PRs (database in PR2, JWT in PR3, SIWE in PR5).
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),
});
