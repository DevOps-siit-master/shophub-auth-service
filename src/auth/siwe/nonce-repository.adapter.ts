export const NONCE_REPOSITORY = Symbol('NONCE_REPOSITORY');

export interface NonceRepository {
  issue(nonce: string, ttlMs: number): Promise<void>;
  consume(nonce: string): Promise<boolean>;
}
