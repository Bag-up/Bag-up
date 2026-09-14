import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { TariffsService } from './tariffs.service';
import { AdminGuard, StaffGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('tariffs')
export class TariffsController {
  constructor(private readonly tariffs: TariffsService) {}

  @Get('active')
  @UseGuards(JwtAuthGuard)
  getActive() {
    return this.tariffs.getActive();
  }

  @Get('all')
  @UseGuards(StaffGuard)
  findAll() {
    return this.tariffs.findAll();
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() data: {
    baseFare: number;
    perKm: number;
    expressMultiplier: number;
    groupeMultiplier?: number;
    prioritaireMultiplier?: number;
    programmeMultiplier: number;
    roundingFactor: number;
  }) {
    return this.tariffs.create(data);
  }

  @Patch(':id/activate')
  @UseGuards(AdminGuard)
  setActive(@Param('id') id: string) {
    return this.tariffs.setActive(id);
  }

  @Get('insurance')
  @UseGuards(StaffGuard)
  getInsuranceConfig() {
    return this.tariffs.getInsuranceConfig();
  }

  @Post('insurance')
  @UseGuards(AdminGuard)
  createInsuranceConfig(@Body() data: {
    partnerName: string;
    partnerContact: string;
    coveragePlafond: number;
    eligibilityMonths: number;
    sinistreProcedure: string;
  }) {
    return this.tariffs.createInsuranceConfig(data);
  }
}
