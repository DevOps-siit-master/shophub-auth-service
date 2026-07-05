import { ApiProperty } from '@nestjs/swagger';

/**
 * Response body returned by register / login / refresh.
 */
export class TokensDto {
  @ApiProperty({
    description: 'Short-lived JWT for authenticating API requests',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Long-lived JWT used to obtain a new access token',
  })
  refreshToken: string;
}
