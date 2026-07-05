import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('argon2');
const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<UsersService, 'create' | 'findByEmail' | 'findById'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;

  const user: User = {
    id: 'user-1',
    email: 'alice@example.com',
    passwordHash: 'stored-hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };
    const configService = { getOrThrow: jest.fn((key: string) => key) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('hashes the password, creates the user and returns a token pair', async () => {
      mockedArgon2.hash.mockResolvedValue('new-hash');
      usersService.create.mockResolvedValue(user);

      const tokens = await service.register({
        email: 'alice@example.com',
        password: 'S3curePass!',
      });

      expect(mockedArgon2.hash).toHaveBeenCalledWith('S3curePass!');
      expect(usersService.create).toHaveBeenCalledWith({
        email: 'alice@example.com',
        passwordHash: 'new-hash',
      });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(tokens).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });

    it('propagates the conflict when the email already exists', async () => {
      mockedArgon2.hash.mockResolvedValue('new-hash');
      usersService.create.mockRejectedValue(new ConflictException());

      await expect(
        service.register({
          email: 'alice@example.com',
          password: 'S3curePass!',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      mockedArgon2.verify.mockResolvedValue(true);

      const tokens = await service.login({
        email: 'alice@example.com',
        password: 'S3curePass!',
      });

      expect(mockedArgon2.verify).toHaveBeenCalledWith(
        'stored-hash',
        'S3curePass!',
      );
      expect(tokens.accessToken).toBe('signed-token');
    });

    it('rejects an unknown email without touching argon2', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mockedArgon2.verify).not.toHaveBeenCalled();
    });

    it('rejects a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      mockedArgon2.verify.mockResolvedValue(false);

      await expect(
        service.login({ email: 'alice@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('issues new tokens for a valid refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
      });
      usersService.findById.mockResolvedValue(user);

      const tokens = await service.refresh('valid.refresh.token');

      expect(usersService.findById).toHaveBeenCalledWith('user-1');
      expect(tokens.refreshToken).toBe('signed-token');
    });

    it('rejects an invalid/expired refresh token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('expired'));

      await expect(service.refresh('bad.token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when the user no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'missing',
        email: 'ghost@example.com',
      });
      usersService.findById.mockResolvedValue(null);

      await expect(service.refresh('valid.token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
