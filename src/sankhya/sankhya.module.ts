import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bull";
import { SankhyaService } from "./sankhya.service";
import { SankhyaController } from "./sankhya.controller";

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: "sankhya-queue",
    }),
  ],
  controllers: [SankhyaController],
  providers: [SankhyaService],
  exports: [SankhyaService],
})
export class SankhyaModule {}
