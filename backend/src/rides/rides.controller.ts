import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/admin.guard';
import { CreateRideDto } from '../dto/create-ride.dto';
import { RidesService } from './rides.service';

@Controller('rides')
@UseGuards(JwtAuthGuard)
export class RidesController {
  constructor(private readonly rides: RidesService) {}

  @Post()
  create(@Body() dto: CreateRideDto, @Request() req: any) {
    return this.rides.create(dto, req.user.sub);
  }

  @Get('available')
  findAvailable(
    @Request() req: any,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
  ) {
    const latNum = lat ? parseFloat(lat) : undefined;
    const lngNum = lng ? parseFloat(lng) : undefined;
    const radiusNum = radius ? parseFloat(radius) : 15;
    return this.rides.findAvailable(latNum, lngNum, radiusNum, req.user.sub);
  }

  @Get()
  @UseGuards(StaffGuard)
  findAll() {
    return this.rides.findAll();
  }

  @Get('mine')
  findMine(@Request() req: any) {
    return this.rides.findMine(req.user.sub);
  }

  @Get('driver')
  findDriverRides(@Request() req: any) {
    return this.rides.findByDriver(req.user.sub);
  }

  @Get(':id/location')
  getLocation(@Param('id') id: string, @Request() req: any) {
    return this.rides.getLocation(id, req.user.sub);
  }

  @Get('pending-cash')
  pendingCash(@Request() req: any) {
    return this.rides.pendingCashConfirm(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const role = req.user?.role;
    if (role === 'admin' || role === 'assistant' || role === 'manager') {
      return this.rides.findByIdStaff(id);
    }
    return this.rides.findById(id, req.user.sub);
  }

  @Patch(':id/accept')
  accept(@Param('id') id: string, @Request() req: any) {
    return this.rides.accept(id, req.user.sub);
  }

  @Patch(':id/refuse')
  refuse(@Param('id') id: string, @Request() req: any) {
    return this.rides.refuse(id, req.user.sub);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.rides.cancel(id, req.user.sub);
  }

  @Patch(':id/confirm-cash')
  confirmCash(@Param('id') id: string, @Request() req: any) {
    return this.rides.confirmCashPayment(id, req.user.sub);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Request() req: any,
  ) {
    return this.rides.updateStatus(id, status as any, req.user.sub);
  }

  @Patch(':id/ready')
  markReady(
    @Param('id') id: string,
    @Body() body: { lat?: number; lng?: number },
    @Request() req: any,
  ) {
    return this.rides.markPassengerReady(id, req.user.sub, body);
  }

  @Patch(':id/location')
  updateLocation(
    @Param('id') id: string,
    @Body() body: { lat: number; lng: number },
    @Request() req: any,
  ) {
    return this.rides.updateLocation(id, body.lat, body.lng, req.user.sub);
  }
}
