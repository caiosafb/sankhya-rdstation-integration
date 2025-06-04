import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { SankhyaService } from "./sankhya.service";
import { SankhyaController } from "./sankhya.controller";

@Module({
  imports: [HttpModule],
  controllers: [SankhyaController],
  providers: [SankhyaService],
  exports: [SankhyaService],
})
export class SankhyaModule {}
