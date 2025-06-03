import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bull";
import { RdStationService } from "./rd-station.service";
import { RdStationController } from "./rd-station.controller";
import { RdStationProcessor } from './rd-station.processor';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: "rd-station-queue",
    }),
  ],
  controllers: [RdStationController],
  providers: [RdStationService, RdStationProcessor],
  exports: [RdStationService],
})
export class RdStationModule {}
