import { IsInt, IsString, IsOptional, Min, Max, ValidateIf } from 'class-validator';

export class CreateRatingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @ValidateIf((o) => !o.rideId)
  @IsString()
  missionId?: string;

  @ValidateIf((o) => !o.missionId)
  @IsString()
  rideId?: string;

  @IsString()
  ratedId: string;
}
