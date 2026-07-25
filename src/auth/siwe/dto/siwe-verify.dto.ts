import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SiweVerifyDto {
  @ApiProperty({
    description:
      'The exact EIP-4361 (SIWE) message string that was presented to the user and signed',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Hex signature of the message produced by the wallet',
    example: '0x…',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;
}
