import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class InitiateSubscriptionDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  /** OTP Orange Money CI/BF uniquement. */
  @IsString()
  @IsOptional()
  otp?: string;

  @IsString()
  @IsOptional()
  successRedirectUrl?: string;

  @IsString()
  @IsOptional()
  errorRedirectUrl?: string;
}
