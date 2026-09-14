import { IsString, MinLength, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class LoginDto {
  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
