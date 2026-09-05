import { type UserRole } from '../auth/auth.types';
import { User } from './entities/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface CreateUserData {
  email: string;
  passwordHash: string;
  role: UserRole;
}

// Declared as function-typed properties (not method shorthand) so mock
// references like `expect(repo.findByEmail).toHaveBeenCalledWith(...)` don't
// trip @typescript-eslint/unbound-method in tests.
export interface UserRepository {
  findById: (id: string) => Promise<User | null>;
  findByEmail: (email: string) => Promise<User | null>;
  findByWalletAddress: (walletAddress: string) => Promise<User | null>;
  createWithEmail: (data: CreateUserData) => Promise<User | null>;
  findOrCreateByWallet: (walletAddress: string) => Promise<User>;
}
