import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { generateNonce, SiweMessage } from 'siwe';
import { LessThan, Repository } from 'typeorm';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { TokensDto } from '../dto/tokens.dto';
import { NonceDto } from './dto/nonce.dto';
import { SiweVerifyDto } from './dto/siwe-verify.dto';
import { SiweNonce } from './entities/siwe-nonce.entity';

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
    @InjectRepository(SiweNonce)
    private readonly nonceRepository: Repository<SiweNonce>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  async createNonce(): Promise<NonceDto> {
    // Opportunistically purge expired nonces so the table does not grow forever.
    await this.nonceRepository.delete({ expiresAt: LessThan(new Date()) });

    const nonce = generateNonce();
    await this.nonceRepository.save(
      this.nonceRepository.create({
        nonce,
        expiresAt: new Date(Date.now() + NONCE_TTL_MS),
      }),
    );
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
    const stored = await this.nonceRepository.findOne({
      where: { nonce: message.nonce },
    });
    await this.nonceRepository.delete({ nonce: message.nonce });
    if (!stored || stored.expiresAt.getTime() < Date.now()) {
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
