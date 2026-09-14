import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/admin.guard';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMine(@Request() req: any) {
    return this.loyalty.getStatus(req.user.sub);
  }

  @Get('admin')
  @UseGuards(StaffGuard)
  adminOverview() {
    return this.loyalty.adminOverview();
  }
}
