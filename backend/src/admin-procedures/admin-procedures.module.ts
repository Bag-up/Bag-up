import { Module } from '@nestjs/common';
import { AdminProceduresService } from './admin-procedures.service';
import { AdminProceduresController } from './admin-procedures.controller';

@Module({
  controllers: [AdminProceduresController],
  providers: [AdminProceduresService],
  exports: [AdminProceduresService],
})
export class AdminProceduresModule {}
