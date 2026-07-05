import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokensDto } from './dto/tokens.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Registers a new user and logs them straight in. Duplicate emails surface
   * as a `ConflictException` from {@link UsersService.create}.
   */
  async register(dto: RegisterDto): Promise<TokensDto> {
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
    });
    return this.issueTokens(user);
  }

  /**
   * Verifies credentials and issues tokens. Uses a single generic error for
   * both "unknown email" and "wrong password" to avoid user enumeration.
   */
  async login(dto: LoginDto): Promise<TokensDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user);
  }

  /**
   * Redeems a refresh token for a fresh token pair.
   */
  async refresh(refreshToken: string): Promise<TokensDto> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.issueTokens(user);
  }

  private async issueTokens(user: User): Promise<TokensDto> {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.signToken(payload, 'JWT_ACCESS_SECRET', 'JWT_ACCESS_TTL'),
      this.signToken(payload, 'JWT_REFRESH_SECRET', 'JWT_REFRESH_TTL'),
    ]);

    return { accessToken, refreshToken };
  }

  private signToken(
    payload: JwtPayload,
    secretKey: string,
    ttlKey: string,
  ): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>(secretKey),
      // TTLs are validated strings like '15m'/'7d'; the option is typed as
      // ms.StringValue, so narrow the config value to the expected union.
      expiresIn: this.configService.getOrThrow<string>(
        ttlKey,
      ) as JwtSignOptions['expiresIn'],
    });
  }
}
