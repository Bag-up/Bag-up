import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRideDto {
  @IsString()
  pickupAddress: string;

  @IsString()
  dropoffAddress: string;

  @IsIn(['moto', 'voiture'])
  vehicleMode: 'moto' | 'voiture';

  @IsString()
  @IsOptional()
  pickupLat?: string;

  @IsString()
  @IsOptional()
  pickupLng?: string;

  @IsString()
  @IsOptional()
  dropoffLat?: string;

  @IsString()
  @IsOptional()
  dropoffLng?: string;

  /** Prix affiché côté client ; recalculé côté serveur si coords valides. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedPrice?: number;
}
