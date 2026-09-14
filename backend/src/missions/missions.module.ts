import { Module, forwardRef } from '@nestjs/common';
import { MissionsService } from './missions.service';
import { MissionsController } from './missions.controller';
import { AuthModule } from '../auth/auth.module';
import { GeoModule } from '../geo/geo.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [AuthModule, GeoModule, NotificationsModule, forwardRef(() => MarketplaceModule), LoyaltyModule],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
