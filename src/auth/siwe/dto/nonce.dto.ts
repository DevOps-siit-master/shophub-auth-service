import { ApiProperty } from '@nestjs/swagger';

/**
 * Response body of `GET /auth/siwe/nonce`.
 */
export class NonceDto {
  @ApiProperty({
    description: 'Single-use nonce to embed in the SIWE message before signing',
    example: 'k3Rf9aQ2xY7bN1pZ',
  })
  nonce: string;
}
