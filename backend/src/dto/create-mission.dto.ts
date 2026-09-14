import { IsEnum, IsString, IsOptional, IsNumber, IsBoolean, IsObject, IsDateString } from 'class-validator';
import { ServiceType, UrgencyLevel } from '@prisma/client';

export class CreateMissionDto {
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @IsEnum(UrgencyLevel)
  urgency: UrgencyLevel;

  @IsString()
  pickupAddress: string;

  @IsString()
  deliveryAddress: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  price: number;

  @IsString()
  @IsOptional()
  pickupLat?: string;

  @IsString()
  @IsOptional()
  pickupLng?: string;

  @IsString()
  @IsOptional()
  deliveryLat?: string;

  @IsString()
  @IsOptional()
  deliveryLng?: string;

  @IsString()
  @IsOptional()
  photos?: string;

  @IsString()
  @IsOptional()
  adminProcedureType?: string;

  @IsString()
  @IsOptional()
  adminOrganism?: string;

  @IsNumber()
  @IsOptional()
  adminFeeEstimated?: number;

  @IsString()
  @IsOptional()
  recipientName?: string;

  @IsString()
  @IsOptional()
  recipientPhone?: string;

  @IsString()
  @IsOptional()
  recipientRelation?: string;

  @IsString()
  @IsOptional()
  recipientAddress?: string;

  @IsString()
  @IsOptional()
  clientCountry?: string;

  @IsBoolean()
  @IsOptional()
  requiresIdVerification?: boolean;

  /** Champs spécifiques au type de service (colis, courses, etc.) */
  @IsObject()
  @IsOptional()
  serviceDetails?: Record<string, unknown>;

  /** moto | voiture — required for delivery-style services */
  @IsString()
  @IsOptional()
  vehicleMode?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
