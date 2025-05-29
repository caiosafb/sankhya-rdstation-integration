import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
} from "@nestjs/common";
import { RdStationService } from "./rd-station.service";
import {
  CreateContactDto,
  UpdateContactDto,
  ConversionDto,
  CreateEventDto,
} from "./dto";

@Controller("rdstation")
export class RdStationController {
  constructor(private readonly rdStationService: RdStationService) {}

  @Patch("contacts/:email")
  async createOrUpdateContact(
    @Param("email") email: string,
    @Body() contact: CreateContactDto
  ) {
    return this.rdStationService.createOrUpdateContact(email, contact);
  }

  @Get("contacts/:email")
  async getContact(@Param("email") email: string) {
    return this.rdStationService.getContact(email);
  }

  @Post("conversions")
  async createConversion(@Body() conversion: ConversionDto) {
    return this.rdStationService.createConversion(conversion);
  }

  @Post("events")
  async createEvent(@Body() event: CreateEventDto) {
    return this.rdStationService.createEvent(event);
  }

  @Post("contacts/:email/tags")
  async addTags(@Param("email") email: string, @Body("tags") tags: string[]) {
    return this.rdStationService.addTagsToContact(email, tags);
  }

  @Post("webhook")
  async handleWebhook(@Body() payload: any) {
    console.log("Webhook received:", {
      event_type: payload.event_type,
      event_uuid: payload.event_uuid,
      entity_type: payload.entity_type,
    });

    switch (payload.event_type) {
      case "CONTACT_CREATED":
        break;
      case "CONTACT_UPDATED":
        break;
      case "CONVERSION":
        break;
    }

    return { status: "received", event_uuid: payload.event_uuid };
  }
}
