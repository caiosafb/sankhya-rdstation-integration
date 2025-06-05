import { Module, forwardRef } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { RdStationService } from "./rd-station.service";
import { RdStationController } from "./rd-station.controller";
import { WebhookModule } from "../webhook/webhook.module";

@Module({
  imports: [HttpModule, forwardRef(() => WebhookModule)],
  controllers: [RdStationController],
  providers: [RdStationService],
  exports: [RdStationService],
})
export class RdStationModule {}
