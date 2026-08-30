import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'alice@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'S3curePass!', description: 'Account password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: 'shop_owner',
    enum: ['shop_owner', 'customer'],
    description: 'Account role used to select the correct login flow',
    required: false,
  })
  @IsOptional()
  @IsIn(['shop_owner', 'customer'])
  role?: 'shop_owner' | 'customer';
}
