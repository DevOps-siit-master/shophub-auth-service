import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { generateNonce, SiweMessage } from 'siwe';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { SiweService } from './siwe.service';
import { NONCE_REPOSITORY, NonceRepository } from './nonce-repository.adapter';

/** Mirrors the private NONCE_TTL_MS in siwe.service.ts. */
const NONCE_TTL_MS = 5 * 60 * 1000;

jest.mock('siwe');
const MockedSiweMessage = SiweMessage as jest.MockedClass<typeof SiweMessage>;
const mockedGenerateNonce = generateNonce as jest.MockedFunction<
  typeof generateNonce
>;

describe('SiweService', () => {
  let service: SiweService;
  let nonceRepo: jest.Mocked<NonceRepository>;
  let usersService: jest.Mocked<Pick<UsersService, 'findOrCreateByWallet'>>;
  let authService: jest.Mocked<Pick<AuthService, 'issueTokens'>>;

  const address = '0x7801E669F7Ac14FD99a4aB906F1A57f77af86935';
  const tokens = { accessToken: 'access', refreshToken: 'refresh' };

  /** Makes `new SiweMessage(...)` yield a controllable instance. */
  const stubSiweMessage = (nonce: string, verify: jest.Mock) => {
    MockedSiweMessage.mockImplementation(
      () => ({ nonce, address, verify }) as unknown as SiweMessage,
    );
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    nonceRepo = {
      consume: jest.fn(),
      issue: jest.fn(),
    };
    usersService = { findOrCreateByWallet: jest.fn() };
    authService = { issueTokens: jest.fn().mockResolvedValue(tokens) };
    const configService = { getOrThrow: jest.fn(() => 'localhost:3000') };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SiweService,
        { provide: NONCE_REPOSITORY, useValue: nonceRepo },
        { provide: ConfigService, useValue: configService },
        { provide: UsersService, useValue: usersService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = moduleRef.get(SiweService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNonce', () => {
    it('issues a fresh nonce with the standard TTL and returns it', async () => {
      mockedGenerateNonce.mockReturnValue('fresh-nonce');
      nonceRepo.issue.mockResolvedValue(undefined);

      const result = await service.createNonce();

      expect(nonceRepo.issue).toHaveBeenCalledWith('fresh-nonce', NONCE_TTL_MS);
      expect(result).toEqual({ nonce: 'fresh-nonce' });
    });
  });

  describe('verify', () => {
    it('verifies the signature, consumes the nonce and returns tokens', async () => {
      const verify = jest.fn().mockResolvedValue({ success: true });
      stubSiweMessage('issued-nonce', verify);
      nonceRepo.consume.mockResolvedValue(true);
      const user = {
        id: 'user-1',
        walletAddress: address.toLowerCase(),
      } as User;
      usersService.findOrCreateByWallet.mockResolvedValue(user);

      const result = await service.verify({
        message: 'msg',
        signature: '0xsig',
      });

      expect(nonceRepo.consume).toHaveBeenCalledWith('issued-nonce');
      expect(verify).toHaveBeenCalledWith(
        expect.objectContaining({ signature: '0xsig', nonce: 'issued-nonce' }),
      );
      expect(usersService.findOrCreateByWallet).toHaveBeenCalledWith(address);
      expect(authService.issueTokens).toHaveBeenCalledWith(user);
      expect(result).toEqual(tokens);
    });

    it('rejects a malformed SIWE message', async () => {
      MockedSiweMessage.mockImplementation(() => {
        throw new Error('parse error');
      });

      await expect(
        service.verify({ message: 'garbage', signature: '0xsig' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a nonce that cannot be consumed (never issued or expired)', async () => {
      const verify = jest.fn();
      stubSiweMessage('issued-nonce', verify);
      nonceRepo.consume.mockResolvedValue(false);

      await expect(
        service.verify({ message: 'msg', signature: '0xsig' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verify).not.toHaveBeenCalled();
    });

    it('rejects when signature verification fails', async () => {
      const verify = jest.fn().mockRejectedValue(new Error('bad signature'));
      stubSiweMessage('issued-nonce', verify);
      nonceRepo.consume.mockResolvedValue(true);

      await expect(
        service.verify({ message: 'msg', signature: '0xbad' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.findOrCreateByWallet).not.toHaveBeenCalled();
    });
  });
});
