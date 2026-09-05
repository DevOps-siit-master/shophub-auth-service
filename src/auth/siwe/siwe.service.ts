import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateNonce, SiweMessage } from 'siwe';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { TokensDto } from '../dto/tokens.dto';
import { NonceDto } from './dto/nonce.dto';
import { SiweVerifyDto } from './dto/siwe-verify.dto';
import {
  NONCE_REPOSITORY,
  type NonceRepository,
} from './nonce-repository.adapter';

/** How long an issued nonce may sit unused before it is rejected. */
const NONCE_TTL_MS = 5 * 60 * 1000;

/**
 * Sign-In With Ethereum (EIP-4361). A wallet proves ownership of an address by
 * signing a server-issued nonce; on success we resolve (or create) the matching
 * wallet-only account and mint the same JWT pair as every other sign-in path.
 */
@Injectable()
export class SiweService {
  constructor(
    @Inject(NONCE_REPOSITORY)
    private readonly nonceRepository: NonceRepository,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  async createNonce(): Promise<NonceDto> {
    const nonce = generateNonce();
    await this.nonceRepository.issue(nonce, NONCE_TTL_MS);
    return { nonce };
  }

  async verify(dto: SiweVerifyDto): Promise<TokensDto> {
    let message: SiweMessage;
    try {
      message = new SiweMessage(dto.message);
    } catch {
      throw new UnauthorizedException('Malformed SIWE message');
    }

    // Consume the nonce up-front: even a valid signature is worthless if the
    // nonce was never issued, already used, or has expired.
    const ok = await this.nonceRepository.consume(message.nonce);
    if (!ok) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }

    try {
      await message.verify({
        signature: dto.signature,
        domain: this.configService.getOrThrow<string>('SIWE_DOMAIN'),
        nonce: message.nonce,
      });
    } catch {
      throw new UnauthorizedException('SIWE signature verification failed');
    }

    const user = await this.usersService.findOrCreateByWallet(message.address);
    return this.authService.issueTokens(user);
  }
}
