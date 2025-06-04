import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from '@nestjs/axios';
import { WebhookService } from "./webhook.service";
import { SankhyaModule } from "../sankhya/sankhya.module";
import { RdStationModule } from "../rd-station/rd-station.module";
import { SyncLog } from "../database/entities/sync-log.entity";
import { WebhookManagementController } from './webhook-management.controller';
import { WebhookManagementService } from './webhook-management.service';



@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([SyncLog]),
    SankhyaModule,
    forwardRef(() => RdStationModule), 
  ],
  controllers: [WebhookManagementController],
  providers: [WebhookService, WebhookManagementService],
  exports: [WebhookService, WebhookManagementService],
})
export class WebhookModule {}
