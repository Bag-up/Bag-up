import { IsString, IsOptional, MinLength, IsEnum, IsEmail } from 'class-validator';
import { UserRole } from '@prisma/client';

export class AdminCreateUserDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsEmail()
  @IsOptional()
  email?: string;
}

export class ChangeMyPasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class DeleteAccountDto {
  @IsString()
  @MinLength(6)
  password: string;
}
