import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  HttpCode,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/admin.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePaymentDto, @Request() req: any) {
    return this.payments.create(dto, req.user.sub);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findMine(@Request() req: any) {
    return this.payments.findByUser(req.user.sub);
  }

  @Get('all')
  @UseGuards(StaffGuard)
  findAll() {
    return this.payments.findAll();
  }

  // ── Webhooks (publics, signés par la passerelle) ──────────────────────────
  // Pas de JWT : l'authenticité repose sur la signature/secret du fournisseur.
  // Le corps brut (req.rawBody) est requis pour valider la signature.

  @Post('webhook/bictorys')
  @HttpCode(200)
  async bictorysWebhook(@Req() req: any) {
    const rawBody = this.rawBodyOf(req);
    await this.payments.handleWebhook('bictorys', rawBody, req.headers);
    return { received: true };
  }

  @Post('webhook/stripe')
  @HttpCode(200)
  async stripeWebhook(@Req() req: any) {
    const rawBody = this.rawBodyOf(req);
    await this.payments.handleWebhook('stripe', rawBody, req.headers);
    return { received: true };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.payments.findById(id);
  }

  /** Lance le paiement auprès de la passerelle et renvoie les infos de redirection. */
  @Post(':id/initiate')
  @UseGuards(JwtAuthGuard)
  initiate(@Param('id') id: string, @Body() dto: InitiatePaymentDto) {
    return this.payments.initiate(id, dto);
  }

  @Patch(':id/success')
  @UseGuards(JwtAuthGuard)
  markSuccess(@Param('id') id: string, @Body('transactionId') transactionId: string) {
    return this.payments.markSuccess(id, transactionId);
  }

  @Patch(':id/failed')
  @UseGuards(JwtAuthGuard)
  markFailed(@Param('id') id: string) {
    return this.payments.markFailed(id);
  }

  private rawBodyOf(req: any): string {
    if (req.rawBody) {
      return Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf-8') : String(req.rawBody);
    }
    return JSON.stringify(req.body ?? {});
  }
}
