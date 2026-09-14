import { Module } from '@nestjs/common';
import { TariffsController } from './tariffs.controller';
import { TariffsService } from './tariffs.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TariffsController],
  providers: [TariffsService],
})
export class TariffsModule {}
