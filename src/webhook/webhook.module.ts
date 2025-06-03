import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WebhookService } from "./webhook.service";
import { SankhyaModule } from "../sankhya/sankhya.module";
import { RdStationModule } from "../rd-station/rd-station.module";
import { SyncLog } from "../database/entities/sync-log.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncLog]),
    SankhyaModule,
    RdStationModule,
  ],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
