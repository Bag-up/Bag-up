import { IsEnum, IsNumber, IsString, IsOptional, ValidateIf } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsNumber()
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ValidateIf((o) => !o.rideId)
  @IsString()
  missionId?: string;

  @ValidateIf((o) => !o.missionId)
  @IsString()
  rideId?: string;

  @IsString()
  @IsOptional()
  transactionId?: string;

  @IsNumber()
  @IsOptional()
  creditUsed?: number;

  @IsString()
  @IsOptional()
  loyaltyRewardId?: string;
}
