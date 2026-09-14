import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  @IsOptional()
  businessAddress?: string;

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
  fcmToken?: string;

  @IsInt()
  @Min(1000)
  @Max(50000)
  @IsOptional()
  demarchesServiceFee?: number;
}
