import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * A single-use nonce issued by `GET /auth/siwe/nonce` and embedded in the SIWE
 * message the client signs. Stored server-side so a signature can only be
 * redeemed once (replay protection), even across service replicas.
 */
@Entity({ name: 'siwe_nonces' })
export class SiweNonce {
  @PrimaryColumn()
  nonce: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
