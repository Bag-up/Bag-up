import { IsString, IsOptional, IsNumber } from 'class-validator';

export class SendMessageDto {
  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  missionId?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsNumber()
  @IsOptional()
  locationLat?: number;

  @IsNumber()
  @IsOptional()
  locationLng?: number;
}

export class CreateConversationDto {
  @IsString()
  providerId: string;

  @IsString()
  @IsOptional()
  missionId?: string;
}
