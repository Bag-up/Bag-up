import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdateLocationDto {
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
}

export class ProviderLocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}
