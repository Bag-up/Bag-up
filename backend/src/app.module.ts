import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MissionsModule } from './missions/missions.module';
import { PaymentsModule } from './payments/payments.module';
import { GeoModule } from './geo/geo.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RatingsModule } from './ratings/ratings.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UploadsModule } from './uploads/uploads.module';
import { AdminProceduresModule } from './admin-procedures/admin-procedures.module';
import { DisputesModule } from './disputes/disputes.module';
import { TariffsModule } from './tariffs/tariffs.module';
import { AntiGaspiModule } from './anti-gaspi/anti-gaspi.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { ContentModule } from './content/content.module';
import { RidesModule } from './rides/rides.module';
import { LoyaltyModule } from './loyalty/loyalty.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    MissionsModule,
    PaymentsModule,
    GeoModule,
    MessagesModule,
    NotificationsModule,
    RatingsModule,
    SubscriptionsModule,
    UploadsModule,
    AdminProceduresModule,
    DisputesModule,
    TariffsModule,
    AntiGaspiModule,
    MarketplaceModule,
    ContentModule,
    RidesModule,
    LoyaltyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
