import { Controller, Get, Patch, Post, Delete, Body, Query, UseGuards, Request, Param, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { AdminCreateUserDto, ChangeMyPasswordDto, AdminResetPasswordDto, DeleteAccountDto } from '../dto/admin-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard, StaffGuard, AccountReviewGuard, isStaffRole } from '../auth/admin.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    const user = await this.users.findById(req.user.sub);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const synced = await this.users.syncSubscriptionExpiry(user);
    const { password, ...safe } = synced as any;
    return safe;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Body() dto: UpdateProfileDto, @Request() req: any) {
    return this.users.update(req.user.sub, dto);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  changeMyPassword(@Body() dto: ChangeMyPasswordDto, @Request() req: any) {
    return this.users.changeMyPassword(req.user.sub, dto.currentPassword, dto.newPassword);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  deleteMe(@Body() dto: DeleteAccountDto, @Request() req: any) {
    return this.users.deleteMyAccount(req.user.sub, dto.password);
  }

  @Patch('me/availability')
  @UseGuards(JwtAuthGuard)
  setAvailability(@Body('isAvailable') isAvailable: boolean, @Request() req: any) {
    return this.users.setAvailability(req.user.sub, !!isAvailable);
  }

  @Get('me/referrals')
  @UseGuards(JwtAuthGuard)
  getMyReferrals(@Request() req: any) {
    return this.users.getMyReferrals(req.user.sub);
  }

  @Get('demarches-providers')
  @UseGuards(JwtAuthGuard)
  demarchesProviders(@Query('zone') zone?: string) {
    return this.users.findDemarchesProviders(zone);
  }

  @Get('providers')
  @UseGuards(JwtAuthGuard)
  listProviders(@Query('zone') zone?: string) {
    return this.users.findByRole('provider', zone);
  }

  @Get('all')
  @UseGuards(StaffGuard)
  findAll() {
    return this.users.findAll();
  }

  @Post()
  @UseGuards(AdminGuard)
  createByAdmin(@Body() dto: AdminCreateUserDto) {
    return this.users.createByAdmin(dto);
  }

  @Get('referrals/all')
  @UseGuards(StaffGuard)
  getAllReferrals() {
    return this.users.getAllReferrals();
  }

  @Get('zones/stats')
  @UseGuards(StaffGuard)
  getZoneStats() {
    return this.users.getZoneStats();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    const { password, ...safe } = user as any;
    // Les pièces d'identité sont confidentielles: visibles uniquement par
    // le staff back-office ou par le propriétaire du compte (cf. §Sécurité du CDC).
    const isStaff = isStaffRole(req.user?.role);
    const isOwner = req.user?.sub === id;
    if (!isStaff && !isOwner) {
      delete safe.idCardUrl;
      delete safe.idCardBackUrl;
      delete safe.licenseUrl;
    }
    return safe;
  }

  @Patch(':id/verify')
  @UseGuards(AccountReviewGuard)
  verifyProvider(@Param('id') id: string) {
    return this.users.verifyProvider(id);
  }

  @Patch(':id/reject-verification')
  @UseGuards(AccountReviewGuard)
  rejectVerification(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.users.rejectVerification(id, body?.reason);
  }

  @Patch(':id/mark-subscription-refunded')
  @UseGuards(AccountReviewGuard)
  markSubscriptionRefunded(@Param('id') id: string) {
    return this.users.markSubscriptionRefunded(id);
  }

  @Patch(':id/password')
  @UseGuards(AdminGuard)
  resetPassword(@Param('id') id: string, @Body() dto: AdminResetPasswordDto) {
    return this.users.resetPasswordByAdmin(id, dto.newPassword);
  }
}
