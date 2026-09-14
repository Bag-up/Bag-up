import { IsString, IsOptional, IsNumber, IsBoolean, IsDateString, Min, MaxLength, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class CreateAntiGaspiBasketDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  /** Prix payé par le client (commission déduite dessus). */
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  price: number;

  @IsString()
  pickupAddress: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  pickupLat?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  pickupLng?: number;

  @IsDateString()
  pickupStartAt: string;

  @IsDateString()
  pickupEndAt: string;

  /** V1.5 — laisser false en V1. */
  @IsBoolean()
  @IsOptional()
  deliveryRequested?: boolean;
}

export class UpdateAntiGaspiBasketDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsString()
  @IsOptional()
  pickupAddress?: string;

  @IsDateString()
  @IsOptional()
  pickupStartAt?: string;

  @IsDateString()
  @IsOptional()
  pickupEndAt?: string;
}

export class UpdateAntiGaspiSettingsDto {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  commissionRate?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(5)
  basketExpiryMinutes?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(5)
  paymentTimeoutMinutes?: number;

  /** Max d'articles actifs (available + reserved) par commerçant. */
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxActiveBaskets?: number;

  @IsString()
  @IsOptional()
  refundPolicy?: string;
}

export class InitiateAntiGaspiPaymentDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

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
