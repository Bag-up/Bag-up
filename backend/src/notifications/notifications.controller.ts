import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { NotificationsService, HOTLINE_PHONE, HOTLINE_EMAIL } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('hotline')
  getHotline() {
    return { phone: HOTLINE_PHONE, email: HOTLINE_EMAIL };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getMyNotifications(@Request() req: any) {
    return this.notifications.getMyNotifications(req.user.sub);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  getUnreadCount(@Request() req: any) {
    return this.notifications.getUnreadCount(req.user.sub);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  markAllAsRead(@Request() req: any) {
    return this.notifications.markAllAsRead(req.user.sub);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.notifications.markAsRead(id, req.user.sub);
  }

  @Post('fcm-token')
  @UseGuards(JwtAuthGuard)
  registerFcmToken(@Body('token') token: string, @Request() req: any) {
    return this.notifications.registerFcmToken(req.user.sub, token);
  }
}
