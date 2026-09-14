import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AntiGaspiService } from './anti-gaspi.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard, StaffGuard } from '../auth/admin.guard';
import {
  CreateAntiGaspiBasketDto,
  InitiateAntiGaspiPaymentDto,
  UpdateAntiGaspiBasketDto,
  UpdateAntiGaspiSettingsDto,
} from '../dto/anti-gaspi.dto';

@Controller('anti-gaspi')
export class AntiGaspiController {
  constructor(private readonly antiGaspi: AntiGaspiService) {}

  // ---- Public / client browse ----

  @Get('baskets')
  listAvailable(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.antiGaspi.listAvailable(
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
      radiusKm ? parseFloat(radiusKm) : 15,
    );
  }

  @Get('baskets/:id')
  getBasket(@Param('id') id: string) {
    return this.antiGaspi.getBasket(id);
  }

  // ---- Client reservations ----

  @Post('baskets/:id/reserve')
  @UseGuards(JwtAuthGuard)
  reserveBasket(@Param('id') id: string, @Request() req: any) {
    return this.antiGaspi.reserveBasket(id, req.user.sub);
  }

  @Get('reservations/me')
  @UseGuards(JwtAuthGuard)
  myReservations(@Request() req: any) {
    return this.antiGaspi.myReservations(req.user.sub);
  }

  @Get('reservations/:id')
  @UseGuards(JwtAuthGuard)
  getReservation(@Param('id') id: string, @Request() req: any) {
    return this.antiGaspi.getReservation(id, req.user.sub);
  }

  @Post('reservations/:id/pay')
  @UseGuards(JwtAuthGuard)
  payReservation(
    @Param('id') id: string,
    @Body() dto: InitiateAntiGaspiPaymentDto,
    @Request() req: any,
  ) {
    return this.antiGaspi.initiatePayment(id, req.user.sub, dto);
  }

  @Post('reservations/:id/claim-gift')
  @UseGuards(JwtAuthGuard)
  claimGift(
    @Param('id') id: string,
    @Body('rewardId') rewardId: string,
    @Request() req: any,
  ) {
    return this.antiGaspi.claimGift(id, req.user.sub, rewardId);
  }

  @Post('reservations/:id/confirm/client')
  @UseGuards(JwtAuthGuard)
  confirmByClient(@Param('id') id: string, @Request() req: any) {
    return this.antiGaspi.confirmByClient(id, req.user.sub);
  }

  @Post('reservations/:id/confirm/merchant')
  @UseGuards(JwtAuthGuard)
  confirmByMerchant(@Param('id') id: string, @Request() req: any) {
    return this.antiGaspi.confirmByMerchant(id, req.user.sub);
  }

  // ---- Merchant ----

  @Post('baskets')
  @UseGuards(JwtAuthGuard)
  createBasket(@Body() dto: CreateAntiGaspiBasketDto, @Request() req: any) {
    return this.antiGaspi.createBasket(dto, req.user.sub);
  }

  @Get('merchant/baskets')
  @UseGuards(JwtAuthGuard)
  myBaskets(@Request() req: any) {
    return this.antiGaspi.myBaskets(req.user.sub);
  }

  @Get('merchant/reservations')
  @UseGuards(JwtAuthGuard)
  merchantReservations(@Request() req: any) {
    return this.antiGaspi.merchantReservations(req.user.sub);
  }

  @Get('merchant/payouts')
  @UseGuards(JwtAuthGuard)
  merchantPayouts(@Request() req: any) {
    return this.antiGaspi.merchantPayouts(req.user.sub);
  }

  @Get('merchant/stats')
  @UseGuards(JwtAuthGuard)
  merchantStats(@Request() req: any) {
    return this.antiGaspi.merchantStats(req.user.sub);
  }

  @Patch('baskets/:id')
  @UseGuards(JwtAuthGuard)
  updateBasket(
    @Param('id') id: string,
    @Body() dto: UpdateAntiGaspiBasketDto,
    @Request() req: any,
  ) {
    return this.antiGaspi.updateBasket(id, dto, req.user.sub);
  }

  @Delete('baskets/:id')
  @UseGuards(JwtAuthGuard)
  cancelBasket(@Param('id') id: string, @Request() req: any) {
    return this.antiGaspi.cancelBasket(id, req.user.sub);
  }

  // ---- Admin settings / stats ----

  @Get('settings')
  @UseGuards(StaffGuard)
  getSettings() {
    return this.antiGaspi.getSettings();
  }

  @Patch('settings')
  @UseGuards(AdminGuard)
  updateSettings(@Body() dto: UpdateAntiGaspiSettingsDto) {
    return this.antiGaspi.updateSettings(dto);
  }

  @Get('admin/stats')
  @UseGuards(StaffGuard)
  adminStats() {
    return this.antiGaspi.adminStats();
  }

  @Get('admin/merchants/:id/overview')
  @UseGuards(StaffGuard)
  adminMerchantOverview(@Param('id') id: string) {
    return this.antiGaspi.adminMerchantOverview(id);
  }

  @Get('admin/payouts')
  @UseGuards(StaffGuard)
  adminPayouts() {
    return this.antiGaspi.adminPayouts();
  }

  @Get('admin/baskets')
  @UseGuards(StaffGuard)
  adminBaskets() {
    return this.antiGaspi.adminBaskets();
  }

  @Get('admin/reservations')
  @UseGuards(StaffGuard)
  adminReservations() {
    return this.antiGaspi.adminReservations();
  }
}
