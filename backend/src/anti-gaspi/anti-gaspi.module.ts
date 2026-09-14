import { Module } from '@nestjs/common';
import { AntiGaspiService } from './anti-gaspi.service';
import { AntiGaspiController } from './anti-gaspi.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentProvidersModule } from '../payments/providers/providers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [PrismaModule, PaymentProvidersModule, NotificationsModule, LoyaltyModule],
  controllers: [AntiGaspiController],
  providers: [AntiGaspiService],
  exports: [AntiGaspiService],
})
export class AntiGaspiModule {}
