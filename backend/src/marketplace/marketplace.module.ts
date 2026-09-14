import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GeoModule } from '../geo/geo.module';
import { PaymentProvidersModule } from '../payments/providers/providers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MissionsModule } from '../missions/missions.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    GeoModule,
    PaymentProvidersModule,
    NotificationsModule,
    forwardRef(() => MissionsModule),
  ],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
