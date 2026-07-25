import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SiweNonce } from './siwe/entities/siwe-nonce.entity';
import { SiweService } from './siwe/siwe.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Email/password + Web3 (SIWE) authentication.
 *
 * Secrets and TTLs are supplied per sign/verify from `ConfigService`, so
 * `JwtModule` is registered without global options.
 */
@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([SiweNonce]),
  ],
  controllers: [AuthController],
  providers: [AuthService, SiweService, JwtStrategy],
})
export class AuthModule {}
