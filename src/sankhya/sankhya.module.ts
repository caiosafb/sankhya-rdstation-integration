import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bull";
import { SankhyaService } from "./sankhya.service";
import { SankhyaController } from "./sankhya.controller";
import { SankhyaProcessor } from './sankhya.processor';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: "sankhya-queue",
    }),
  ],
  controllers: [SankhyaController],
  providers: [SankhyaService, SankhyaProcessor],
  exports: [SankhyaService],
})
export class SankhyaModule {}
