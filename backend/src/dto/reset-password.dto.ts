import { IsString, MinLength, IsEmail, IsOptional, IsIn, ValidateIf } from 'class-validator';
import { UserRole } from '@prisma/client';

export class ForgotPasswordDto {
  /** Email OU téléphone requis (au moins un des deux). */
  @ValidateIf((o: ForgotPasswordDto) => !o.phone?.trim())
  @IsEmail({}, { message: 'Email invalide' })
  email?: string;

  @ValidateIf((o: ForgotPasswordDto) => !o.email?.trim())
  @IsString()
  @MinLength(8, { message: 'Numéro de téléphone trop court' })
  phone?: string;

  @IsOptional()
  @IsIn(['client', 'provider', 'merchant'])
  role?: UserRole;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
