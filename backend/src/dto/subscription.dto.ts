import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { SubscriptionType, PaymentMethod } from '@prisma/client';

export class CreateSubscriptionDto {
  @IsEnum(SubscriptionType)
  type: SubscriptionType;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsString()
  @IsOptional()
  transactionId?: string;

  /** Crédit wallet (parrainage) à appliquer, plafonné au solde côté serveur. */
  @IsInt()
  @Min(0)
  @IsOptional()
  creditUsed?: number;
}
