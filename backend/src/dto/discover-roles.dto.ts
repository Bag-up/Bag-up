import { IsEmail, IsOptional, IsString } from 'class-validator';

export class DiscoverRolesDto {
  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
