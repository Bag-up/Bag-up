import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard, StaffGuard, ManagerWriteGuard } from '../auth/admin.guard';
import {
  CreateMarketplaceOrderDto,
  CreateProductDto,
  CreateShopDto,
  InitiateMarketplacePaymentDto,
  MarketplaceQuoteDto,
  UpdateProductDto,
  UpdateShopDto,
} from '../dto/marketplace.dto';
import { MarketplaceService } from './marketplace.service';
import { ShopStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('shops')
  @UseGuards(JwtAuthGuard)
  createShop(@Body() dto: CreateShopDto, @Request() req: any) {
    return this.marketplace.createShop(dto, req.user.sub);
  }

  @Get('shops/me')
  @UseGuards(JwtAuthGuard)
  getMyShop(@Request() req: any) {
    return this.marketplace.getMyShop(req.user.sub);
  }

  @Patch('shops/me')
  @UseGuards(JwtAuthGuard)
  updateMyShop(@Body() dto: UpdateShopDto, @Request() req: any) {
    return this.marketplace.updateMyShop(dto, req.user.sub);
  }

  @Post('products')
  @UseGuards(JwtAuthGuard)
  createProduct(@Body() dto: CreateProductDto, @Request() req: any) {
    return this.marketplace.createProduct(dto, req.user.sub);
  }

  @Get('products/me')
  @UseGuards(JwtAuthGuard)
  listMyProducts(@Request() req: any) {
    return this.marketplace.listMyProducts(req.user.sub);
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard)
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto, @Request() req: any) {
    return this.marketplace.updateProduct(id, dto, req.user.sub);
  }

  @Post('products/:id/publish')
  @UseGuards(JwtAuthGuard)
  publishProduct(@Param('id') id: string, @Request() req: any) {
    return this.marketplace.publishProduct(id, req.user.sub);
  }

  @Patch('products/:id/archive')
  @UseGuards(JwtAuthGuard)
  archiveProduct(@Param('id') id: string, @Request() req: any) {
    return this.marketplace.archiveProduct(id, req.user.sub);
  }

  @Post('quote')
  @UseGuards(JwtAuthGuard)
  quote(@Body() dto: MarketplaceQuoteDto) {
    return this.marketplace.quote(dto);
  }

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  createOrder(@Body() dto: CreateMarketplaceOrderDto, @Request() req: any) {
    return this.marketplace.createOrder(dto, req.user.sub);
  }

  @Get('orders/me')
  @UseGuards(JwtAuthGuard)
  myOrders(@Request() req: any) {
    return this.marketplace.myOrders(req.user.sub);
  }

  @Get('orders/shop')
  @UseGuards(JwtAuthGuard)
  shopOrders(@Request() req: any) {
    return this.marketplace.shopOrders(req.user.sub);
  }

  @Post('orders/:id/prepare')
  @UseGuards(JwtAuthGuard)
  markPrepared(@Param('id') id: string, @Request() req: any) {
    return this.marketplace.markPrepared(id, req.user.sub);
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  getOrder(@Param('id') id: string, @Request() req: any) {
    return this.marketplace.getOrder(id, req.user.sub);
  }

  @Post('orders/:id/pay')
  @UseGuards(JwtAuthGuard)
  payOrder(
    @Param('id') id: string,
    @Body() dto: InitiateMarketplacePaymentDto,
    @Request() req: any,
  ) {
    return this.marketplace.initiatePayment(id, req.user.sub, dto);
  }

  @Get('fx')
  getFx() {
    return this.marketplace.getFxInfo();
  }

  @Get('shops')
  listShops(@Query('city') city?: string) {
    return this.marketplace.listShops(city);
  }

  @Get('shops/:id')
  getShop(@Param('id') id: string) {
    return this.marketplace.getShop(id);
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.marketplace.getProduct(id);
  }

  @Get('admin/shops')
  @UseGuards(JwtAuthGuard, StaffGuard)
  adminListShops() {
    return this.prisma.shop.findMany({
      include: { owner: { select: { id: true, phone: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch('admin/shops/:id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminSetStatus(@Param('id') id: string, @Body() body: { status: ShopStatus }) {
    return this.prisma.shop.update({
      where: { id },
      data: { status: body.status },
    });
  }

  @Get('admin/payouts')
  @UseGuards(JwtAuthGuard, StaffGuard)
  adminPayouts() {
    return this.marketplace.adminListPayouts();
  }

  @Get('admin/orders')
  @UseGuards(JwtAuthGuard, StaffGuard)
  adminOrders(@Query('status') status?: string) {
    return this.marketplace.adminListOrders(status);
  }

  @Patch('admin/orders/:id/assign')
  @UseGuards(JwtAuthGuard, ManagerWriteGuard)
  adminAssign(
    @Param('id') id: string,
    @Body() body: { providerId: string },
  ) {
    return this.marketplace.adminAssignProvider(id, body.providerId);
  }

  @Patch('admin/orders/:id/payout')
  @UseGuards(JwtAuthGuard, ManagerWriteGuard)
  adminMarkPaidOut(@Param('id') id: string) {
    return this.marketplace.adminMarkPaidOut(id);
  }
}
