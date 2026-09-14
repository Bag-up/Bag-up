import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from '../dto/subscription.dto';
import { InitiateSubscriptionDto } from '../dto/initiate-subscription.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/admin.guard';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateSubscriptionDto, @Request() req: any) {
    return this.subscriptions.create(dto, req.user.sub);
  }

  /** Lance le paiement de l'abonnement auprès de la passerelle. */
  @Post(':id/initiate')
  @UseGuards(JwtAuthGuard)
  initiate(@Param('id') id: string, @Body() dto: InitiateSubscriptionDto) {
    return this.subscriptions.initiate(id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  mine(@Request() req: any) {
    return this.subscriptions.findByUser(req.user.sub);
  }

  @Patch(':id/success')
  @UseGuards(JwtAuthGuard)
  markSuccess(@Param('id') id: string, @Body('transactionId') transactionId: string) {
    return this.subscriptions.markSuccess(id, transactionId);
  }

  @Patch(':id/failed')
  @UseGuards(JwtAuthGuard)
  markFailed(@Param('id') id: string) {
    return this.subscriptions.markFailed(id);
  }

  @Get('stats')
  @UseGuards(StaffGuard)
  stats() {
    return this.subscriptions.getStats();
  }

  @Get('all')
  @UseGuards(StaffGuard)
  findAll() {
    return this.subscriptions.findAll();
  }

  @Get('active')
  @UseGuards(StaffGuard)
  activeSubscriptions() {
    return this.subscriptions.getActiveSubscriptions();
  }

  /** Comptes validés sans paiement d'adhésion / abo (à relancer). */
  @Get('unpaid-verified')
  @UseGuards(StaffGuard)
  unpaidVerified() {
    return this.subscriptions.getUnpaidVerified();
  }
}
