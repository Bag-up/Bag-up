import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class CreateShopDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsString()
  @MaxLength(150)
  description: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsString()
  category: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  instagram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  facebook?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tiktok?: string;
}

export class UpdateShopDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  coverUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  description?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string | null;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  instagram?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  facebook?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tiktok?: string | null;
}

export class CreateProductDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceXof: number;

  @IsString()
  @MaxLength(300)
  description: string;

  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  photoUrls: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  weightKg: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lengthCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  widthCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  heightCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceXof?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  weightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lengthCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  widthCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  heightCm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;
}

export class MarketplaceQuoteDto {
  @IsString()
  productId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryLng?: number;

  @IsOptional()
  @IsString()
  deliveryCountry?: string;

  /**
   * bagup_courier | handoff_tiers | handoff_gp
   * (legacy pickup_store / merchant_courier / handoff_sn refusés pour nouvelles commandes)
   */
  @IsOptional()
  @IsString()
  @IsIn(['bagup_courier', 'handoff_tiers', 'handoff_gp'])
  deliveryMode?: string;

  /** true = livré à l’acheteur ; false = tiers / diaspora au Sénégal */
  @IsOptional()
  @IsBoolean()
  deliverToSelf?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  recipientRelation?: string;
}

export class CreateMarketplaceOrderDto extends MarketplaceQuoteDto {}

export class InitiateMarketplacePaymentDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  otp?: string;

  @IsOptional()
  @IsString()
  successRedirectUrl?: string;

  @IsOptional()
  @IsString()
  errorRedirectUrl?: string;
}
