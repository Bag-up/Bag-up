import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ExternalNotificationsService } from './external-notifications.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, ExternalNotificationsService],
  exports: [NotificationsService, ExternalNotificationsService],
})
export class NotificationsModule {}
