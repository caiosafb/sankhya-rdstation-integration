import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { SankhyaModule } from '../sankhya/sankhya.module';
import { RdStationModule } from '../rd-station/rd-station.module';
import { SyncLog } from '../database/entities/sync-log.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([SyncLog]),
    SankhyaModule,
    RdStationModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
