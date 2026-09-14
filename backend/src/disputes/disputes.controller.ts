import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffGuard } from '../auth/admin.guard';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post()
  create(@Body() data: { missionId: string; reason: string; description?: string; evidence?: string }, @Request() req: any) {
    return this.disputes.create({ ...data, raisedById: req.user.sub });
  }

  @Get()
  findAll() {
    return this.disputes.findAll();
  }

  @Get('mine')
  findMine(@Request() req: any) {
    return this.disputes.findByUser(req.user.sub);
  }

  @Get(':id')
  findByMission(@Param('id') id: string) {
    return this.disputes.findByMission(id);
  }

  @Patch(':id')
  @UseGuards(StaffGuard)
  update(@Param('id') id: string, @Body() data: { status?: any; decision?: any; adminNotes?: string }) {
    return this.disputes.update(id, data);
  }
}
