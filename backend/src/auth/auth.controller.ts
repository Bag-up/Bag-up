import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { ForgotPasswordDto, ResetPasswordDto } from '../dto/reset-password.dto';
import { DiscoverRolesDto } from '../dto/discover-roles.dto';
import { OptionalJwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('discover-roles')
  discoverRoles(@Body() dto: DiscoverRolesDto) {
    return this.auth.discoverRoles(dto);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('send-otp')
  @UseGuards(OptionalJwtAuthGuard)
  sendOtp(
    @Body('phone') phone: string,
    @Body('email') email: string | undefined,
    @Request() req: any,
  ) {
    return this.auth.sendOtp(phone, req.user?.sub, email);
  }

  @Post('verify-otp')
  @UseGuards(OptionalJwtAuthGuard)
  verifyOtp(@Body('phone') phone: string, @Body('code') code: string, @Request() req: any) {
    return this.auth.verifyOtp(phone, code, req.user?.sub);
  }

  @Post('skip-otp')
  @UseGuards(OptionalJwtAuthGuard)
  skipOtp(@Body('phone') phone: string, @Request() req: any) {
    return this.auth.skipOtp(phone, req.user?.sub);
  }
}
