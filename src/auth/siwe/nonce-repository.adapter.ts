export const NONCE_REPOSITORY = Symbol('NONCE_REPOSITORY');

// Function-typed properties, not method shorthand — see the same note on
// UserRepository in ../../users/user-repository.adapter.ts.
export interface NonceRepository {
  issue: (nonce: string, ttlMs: number) => Promise<void>;
  consume: (nonce: string) => Promise<boolean>;
}
