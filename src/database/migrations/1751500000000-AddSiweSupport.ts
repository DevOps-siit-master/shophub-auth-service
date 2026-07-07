import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds Web3 (SIWE) support:
 *  - wallet-only accounts: `email`/`password_hash` become nullable and a unique
 *    `wallet_address` column is introduced (Postgres unique indexes permit many
 *    NULLs, so email-only and wallet-only users coexist);
 *  - `siwe_nonces` table backing single-use, replica-safe nonce challenges.
 */
export class AddSiweSupport1751500000000 implements MigrationInterface {
  name = 'AddSiweSupport1751500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "wallet_address" character varying`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_wallet_address" ON "users" ("wallet_address")`,
    );

    await queryRunner.query(`
      CREATE TABLE "siwe_nonces" (
        "nonce" character varying NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_siwe_nonces_nonce" PRIMARY KEY ("nonce")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "siwe_nonces"`);
    await queryRunner.query(`DROP INDEX "UQ_users_wallet_address"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "wallet_address"`);
    // Restoring NOT NULL would fail if wallet-only rows exist, so leave the
    // email/password columns nullable on rollback.
  }
}
