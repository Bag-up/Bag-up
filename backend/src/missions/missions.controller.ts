import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { MissionsService } from './missions.service';
import { CreateMissionDto } from '../dto/create-mission.dto';
import { MissionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard, StaffGuard, ManagerWriteGuard } from '../auth/admin.guard';

@Controller('missions')
@UseGuards(JwtAuthGuard)
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Post()
  create(@Body() dto: CreateMissionDto, @Request() req: any) {
    return this.missions.create(dto, req.user.sub);
  }

  @Get()
  @UseGuards(StaffGuard)
  findAll() {
    return this.missions.findAll();
  }

  @Get('stats')
  @UseGuards(StaffGuard)
  getStats() {
    return this.missions.getStats();
  }

  @Get('admin/payouts')
  @UseGuards(StaffGuard)
  adminListPayouts() {
    return this.missions.adminListPayouts();
  }

  @Patch('admin/:id/payout')
  @UseGuards(ManagerWriteGuard)
  adminMarkPaidOut(@Param('id') id: string) {
    return this.missions.adminMarkPaidOut(id);
  }

  @Get('available')
  findAvailable(
    @Request() req: any,
    @Query('zone') zone?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
  ) {
    const latNum = lat ? parseFloat(lat) : undefined;
    const lngNum = lng ? parseFloat(lng) : undefined;
    const radiusNum = radius ? parseFloat(radius) : 15;
    return this.missions.findAvailable(zone, latNum, lngNum, radiusNum, req.user.sub);
  }

  @Get('mine')
  findMine(@Request() req: any) {
    return this.missions.findByClient(req.user.sub);
  }

  @Get('provider')
  findProviderMissions(@Request() req: any) {
    return this.missions.findByProvider(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.missions.findById(id);
  }

  @Patch(':id/accept')
  accept(@Param('id') id: string, @Request() req: any) {
    return this.missions.accept(id, req.user.sub);
  }

  @Patch(':id/refuse')
  refuse(@Param('id') id: string) {
    return this.missions.refuse(id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.missions.cancel(id, req.user.sub);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: MissionStatus, @Body('code') code?: string) {
    return this.missions.updateStatus(id, status, code);
  }

  @Patch(':id/location')
  updateLocation(@Param('id') id: string, @Body() body: { lat: number; lng: number }, @Request() req: any) {
    return this.missions.updateProviderLocation(id, body.lat, body.lng);
  }

  // Le prestataire soumet le justificatif et le montant réel des frais administratifs avancés
  @Patch(':id/admin-fee/receipt')
  submitAdminFeeReceipt(
    @Param('id') id: string,
    @Body() body: { actualFee: number; receiptUrl: string },
    @Request() req: any,
  ) {
    return this.missions.submitAdminFeeReceipt(id, req.user.sub, body.actualFee, body.receiptUrl);
  }

  // L'admin valide le remboursement des frais administratifs au prestataire
  @Patch(':id/admin-fee/reimburse')
  @UseGuards(ManagerWriteGuard)
  reimburseAdminFee(@Param('id') id: string) {
    return this.missions.reimburseAdminFee(id);
  }

  @Get(':id/location')
  getLocation(@Param('id') id: string) {
    return this.missions.getProviderLocation(id);
  }
}
