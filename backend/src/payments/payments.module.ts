import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AuthModule } from '../auth/auth.module';
import { PaymentProvidersModule } from './providers/providers.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AntiGaspiModule } from '../anti-gaspi/anti-gaspi.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RidesModule } from '../rides/rides.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [
    AuthModule,
    PaymentProvidersModule,
    SubscriptionsModule,
    AntiGaspiModule,
    MarketplaceModule,
    NotificationsModule,
    RidesModule,
    LoyaltyModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
