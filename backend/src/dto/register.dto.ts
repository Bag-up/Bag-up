import { IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
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

  @IsString()
  @IsOptional()
  vehicleType?: string;

  @IsString()
  @IsOptional()
  vehiclePlate?: string;

  @IsString()
  @IsOptional()
  vehicleBrand?: string;

  @IsString()
  @IsOptional()
  vehicleModel?: string;

  @IsString()
  @IsOptional()
  vehicleColor?: string;

  @IsString()
  @IsOptional()
  vehiclePhotoUrl?: string;

  @IsString()
  @IsOptional()
  idCardUrl?: string;

  @IsString()
  @IsOptional()
  idCardBackUrl?: string;

  @IsString()
  @IsOptional()
  licenseUrl?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  zone?: string;

  @IsString()
  @IsOptional()
  serviceCategories?: string;

  @IsInt()
  @Min(1000)
  @Max(50000)
  @IsOptional()
  demarchesServiceFee?: number;

  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  @IsOptional()
  businessAddress?: string;

  @IsArray()
  @IsOptional()
  @IsIn(['antigaspi', 'marketplace'], { each: true })
  merchantChannels?: string[];

  @IsString()
  @IsOptional()
  referredBy?: string;

  // Anti-fraude parrainage (CDC §16): empreintes d'appareil/réseau
  @IsString()
  @IsOptional()
  deviceId?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;
}
