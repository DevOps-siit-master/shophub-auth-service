import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<
    Pick<Repository<User>, 'findOne' | 'create' | 'save'>
  >;

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repository },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('normalizes the email before querying', async () => {
      repository.findOne.mockResolvedValue(null);

      await service.findByEmail('  Alice@Example.COM ');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
      });
    });
  });

  describe('create', () => {
    it('persists a normalized user when the email is free', async () => {
      const saved = { id: 'uuid-1', email: 'alice@example.com' } as User;
      repository.findOne.mockResolvedValue(null);
      repository.create.mockImplementation((data) => data as User);
      repository.save.mockResolvedValue(saved);

      const result = await service.create({
        email: 'Alice@Example.com',
        passwordHash: 'hashed',
      });

      expect(repository.create).toHaveBeenCalledWith({
        email: 'alice@example.com',
        passwordHash: 'hashed',
      });
      expect(result).toBe(saved);
    });

    it('rejects a duplicate email with ConflictException', async () => {
      repository.findOne.mockResolvedValue({ id: 'existing' } as User);

      await expect(
        service.create({ email: 'alice@example.com', passwordHash: 'hashed' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
