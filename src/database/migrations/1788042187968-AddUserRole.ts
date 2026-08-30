import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRole1788042187968 implements MigrationInterface {
  name = 'AddUserRole1788042187968';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_users_email"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_users_wallet_address"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" character varying NOT NULL DEFAULT 'shop_owner'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_196ef3e52525d3cd9e203bdb1d" ON "users"  ("wallet_address") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_196ef3e52525d3cd9e203bdb1d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_wallet_address" ON "users" USING btree ("wallet_address") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_email" ON "users" USING btree ("email") `,
    );
  }
}
