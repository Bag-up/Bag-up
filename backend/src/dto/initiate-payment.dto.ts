import { IsOptional, IsString } from 'class-validator';

export class InitiatePaymentDto {
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
