import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { generateNonce, SiweMessage } from 'siwe';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { SiweService } from './siwe.service';
import { SiweNonce } from './entities/siwe-nonce.entity';

jest.mock('siwe');
const MockedSiweMessage = SiweMessage as jest.MockedClass<typeof SiweMessage>;
const mockedGenerateNonce = generateNonce as jest.MockedFunction<
  typeof generateNonce
>;

describe('SiweService', () => {
  let service: SiweService;
  let nonceRepo: jest.Mocked<
    Pick<Repository<SiweNonce>, 'findOne' | 'delete' | 'save' | 'create'>
  >;
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
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(),
      create: jest.fn().mockImplementation((data) => data as SiweNonce),
    };
    usersService = { findOrCreateByWallet: jest.fn() };
    authService = { issueTokens: jest.fn().mockResolvedValue(tokens) };
    const configService = { getOrThrow: jest.fn(() => 'localhost:3000') };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SiweService,
        { provide: getRepositoryToken(SiweNonce), useValue: nonceRepo },
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
    it('purges expired nonces, stores a fresh one with a TTL and returns it', async () => {
      mockedGenerateNonce.mockReturnValue('fresh-nonce');
      let saved: SiweNonce | undefined;
      nonceRepo.save.mockImplementation((entity) => {
        saved = entity as SiweNonce;
        return Promise.resolve(saved);
      });

      const result = await service.createNonce();

      expect(nonceRepo.delete).toHaveBeenCalled();
      expect(saved?.nonce).toBe('fresh-nonce');
      expect(saved?.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(result).toEqual({ nonce: 'fresh-nonce' });
    });
  });

  describe('verify', () => {
    const validStored = (): SiweNonce => ({
      nonce: 'issued-nonce',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    it('verifies the signature, consumes the nonce and returns tokens', async () => {
      const verify = jest.fn().mockResolvedValue({ success: true });
      stubSiweMessage('issued-nonce', verify);
      nonceRepo.findOne.mockResolvedValue(validStored());
      const user = {
        id: 'user-1',
        walletAddress: address.toLowerCase(),
      } as User;
      usersService.findOrCreateByWallet.mockResolvedValue(user);

      const result = await service.verify({
        message: 'msg',
        signature: '0xsig',
      });

      expect(verify).toHaveBeenCalledWith(
        expect.objectContaining({ signature: '0xsig', nonce: 'issued-nonce' }),
      );
      // Nonce is consumed (single use).
      expect(nonceRepo.delete).toHaveBeenCalledWith({ nonce: 'issued-nonce' });
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

    it('rejects a nonce that was never issued', async () => {
      const verify = jest.fn();
      stubSiweMessage('issued-nonce', verify);
      nonceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verify({ message: 'msg', signature: '0xsig' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verify).not.toHaveBeenCalled();
    });

    it('rejects an expired nonce', async () => {
      const verify = jest.fn();
      stubSiweMessage('issued-nonce', verify);
      nonceRepo.findOne.mockResolvedValue({
        nonce: 'issued-nonce',
        expiresAt: new Date(Date.now() - 1_000),
        createdAt: new Date(),
      });

      await expect(
        service.verify({ message: 'msg', signature: '0xsig' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verify).not.toHaveBeenCalled();
    });

    it('rejects when signature verification fails', async () => {
      const verify = jest.fn().mockRejectedValue(new Error('bad signature'));
      stubSiweMessage('issued-nonce', verify);
      nonceRepo.findOne.mockResolvedValue(validStored());

      await expect(
        service.verify({ message: 'msg', signature: '0xbad' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.findOrCreateByWallet).not.toHaveBeenCalled();
    });
  });
});
