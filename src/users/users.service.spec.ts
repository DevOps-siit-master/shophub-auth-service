import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { USER_REPOSITORY, UserRepository } from './user-repository.adapter';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    repository = {
      findByWalletAddress: jest.fn(),
      findOrCreateByWallet: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      createWithEmail: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: USER_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('normalizes the email before querying', async () => {
      repository.findByEmail.mockResolvedValue(null);

      await service.findByEmail('  Alice@Example.COM ');

      expect(repository.findByEmail).toHaveBeenCalledWith('alice@example.com');
    });
  });

  describe('create', () => {
    it('persists a normalized user when the email is free', async () => {
      const saved = { id: 'uuid-1', email: 'alice@example.com' } as User;
      repository.createWithEmail.mockResolvedValue(saved);

      const result = await service.create({
        email: 'Alice@Example.com',
        passwordHash: 'hashed',
      });

      expect(repository.createWithEmail).toHaveBeenCalledWith({
        email: 'alice@example.com',
        passwordHash: 'hashed',
      });
      expect(result).toBe(saved);
    });

    it('rejects a duplicate email with ConflictException', async () => {
      repository.createWithEmail.mockResolvedValue(null);

      await expect(
        service.create({ email: 'alice@example.com', passwordHash: 'hashed' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
