import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from '../dto/rating.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Post()
  create(@Body() dto: CreateRatingDto, @Request() req: any) {
    return this.ratings.create(dto, req.user.sub);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.ratings.findByUser(userId);
  }

  @Get('mission/:missionId')
  findByMission(@Param('missionId') missionId: string) {
    return this.ratings.findByMission(missionId);
  }

  @Get('ride/:rideId')
  findByRide(@Param('rideId') rideId: string) {
    return this.ratings.findByRide(rideId);
  }

  @Get('mine')
  findByRater(@Request() req: any) {
    return this.ratings.findByRater(req.user.sub);
  }
}
