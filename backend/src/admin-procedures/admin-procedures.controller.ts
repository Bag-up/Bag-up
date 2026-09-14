import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminProceduresService } from './admin-procedures.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard, StaffGuard } from '../auth/admin.guard';

@Controller('admin-procedures')
export class AdminProceduresController {
  constructor(private readonly procedures: AdminProceduresService) {}

  @Get()
  findAll() {
    return this.procedures.findAll();
  }

  @Get('category/:category')
  findByCategory(@Param('category') category: string) {
    return this.procedures.findByCategory(category);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, StaffGuard)
  findAllAdmin() {
    return this.procedures.findAllAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() data: { name: string; category: string; organism: string; intervention: string; estimatedFee?: number; estimatedDelay?: string; isActive?: boolean }) {
    return this.procedures.create(data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() data: { name?: string; category?: string; organism?: string; intervention?: string; estimatedFee?: number; estimatedDelay?: string; isActive?: boolean }) {
    return this.procedures.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string) {
    return this.procedures.remove(id);
  }
}
