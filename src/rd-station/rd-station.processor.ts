import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { RdStationService } from "./rd-station.service";
import { CreateContactDto, ConversionDto } from "./dto";

@Processor("rd-station-queue")
export class RdStationProcessor {
  private readonly logger = new Logger(RdStationProcessor.name);

  constructor(private readonly rdStationService: RdStationService) {}

  @Process("create-or-update-contact")
  async handleCreateOrUpdateContact(job: Job<CreateContactDto>) {
    this.logger.log(`Processing contact: ${job.data.email}`);

    try {
      const result = await this.rdStationService.createOrUpdateContact(
        job.data.email,
        job.data
      );

      this.logger.log(`Contact processed successfully: ${job.data.email}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process contact: ${job.data.email}`, error);
      throw error;
    }
  }

  @Process("create-conversion")
  async handleCreateConversion(job: Job<ConversionDto>) {
    this.logger.log(`Processing conversion for: ${job.data.email}`);

    try {
      const result = await this.rdStationService.createConversion(job.data);

      this.logger.log(`Conversion processed successfully: ${job.data.email}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process conversion: ${job.data.email}`,
        error
      );
      throw error;
    }
  }

  @Process("batch-update-tags")
  async handleBatchUpdateTags(job: Job<{ email: string; tags: string[] }>) {
    this.logger.log(`Processing tags update for: ${job.data.email}`);

    try {
      const result = await this.rdStationService.addTagsToContact(
        job.data.email,
        job.data.tags
      );

      this.logger.log(`Tags updated successfully for: ${job.data.email}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to update tags for: ${job.data.email}`, error);
      throw error;
    }
  }
}
