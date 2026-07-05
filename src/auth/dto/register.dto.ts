import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'alice@example.com',
    description: 'User email address (case-insensitive, stored normalized)',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'S3curePass!',
    minLength: 8,
    maxLength: 128,
    description: 'Plain-text password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
