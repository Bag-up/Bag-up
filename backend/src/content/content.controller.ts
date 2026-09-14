import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard, StaffGuard } from '../auth/admin.guard';

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('app-release')
  appRelease() {
    return {
      latestVersion: process.env.APP_LATEST_VERSION || '1.0.23',
      force: process.env.APP_FORCE_UPDATE === 'true',
      message:
        process.env.APP_UPDATE_MESSAGE ||
        "Une nouvelle version de Bag'up est disponible. Mettez à jour pour profiter des dernières améliorations.",
      iosUrl: process.env.APP_IOS_URL || 'https://apps.apple.com/app/id6793175800',
      androidUrl:
        process.env.APP_ANDROID_URL || 'https://play.google.com/store/apps/details?id=sn.bagup.app',
    };
  }

  @Get('promos')
  listPromos() {
    return this.content.listPublicPromos();
  }

  @Get('home-banners')
  listHomeBanners() {
    return this.content.listPublicBanners();
  }

  @Get('admin/promos')
  @UseGuards(JwtAuthGuard, StaffGuard)
  listAdminPromos() {
    return this.content.listAdminPromos();
  }

  @Post('admin/promos')
  @UseGuards(JwtAuthGuard, AdminGuard)
  createPromo(@Body() body: any) {
    return this.content.createPromo(body);
  }

  @Patch('admin/promos/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updatePromo(@Param('id') id: string, @Body() body: any) {
    return this.content.updatePromo(id, body);
  }

  @Delete('admin/promos/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  removePromo(@Param('id') id: string) {
    return this.content.removePromo(id);
  }

  @Get('admin/home-banners')
  @UseGuards(JwtAuthGuard, StaffGuard)
  listAdminBanners() {
    return this.content.listAdminBanners();
  }

  @Post('admin/home-banners')
  @UseGuards(JwtAuthGuard, AdminGuard)
  createBanner(@Body() body: any) {
    return this.content.createBanner(body);
  }

  @Patch('admin/home-banners/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updateBanner(@Param('id') id: string, @Body() body: any) {
    return this.content.updateBanner(id, body);
  }

  @Delete('admin/home-banners/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  removeBanner(@Param('id') id: string) {
    return this.content.removeBanner(id);
  }
}
