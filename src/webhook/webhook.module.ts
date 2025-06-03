import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WebhookService } from "./webhook.service";
import { SankhyaModule } from "../sankhya/sankhya.module";
import { RdStationModule } from "../rd-station/rd-station.module";
import { SyncLog } from "../database/entities/sync-log.entity";
import { WebhookManagementController } from './webhook-management.controller';
import { WebhookManagementService } from './webhook-management.service';



@Module({
  imports: [
    TypeOrmModule.forFeature([SyncLog]),
    SankhyaModule,
    RdStationModule,
  ],
  controllers: [WebhookManagementController],
  providers: [WebhookService, WebhookManagementService],
  exports: [WebhookService, WebhookManagementService],
})
export class WebhookModule {}
