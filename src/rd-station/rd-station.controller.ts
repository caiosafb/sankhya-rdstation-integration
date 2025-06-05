import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  Headers,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { RdStationService } from "./rd-station.service";
import { WebhookService } from "../webhook/webhook.service";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import {
  CreateContactDto,
  UpdateContactDto,
  ConversionDto,
  CreateEventDto,
} from "./dto";

@Controller("rdstation")
export class RdStationController {
  private readonly webhookSecret: string;

  constructor(
    private readonly rdStationService: RdStationService,
    private readonly webhookService: WebhookService,
    private readonly configService: ConfigService
  ) {
    this.webhookSecret = this.configService.get<string>("WEBHOOK_SECRET") || "";
  }

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
  async handleWebhook(
    @Body() payload: any,
    @Headers("x-rd-signature") signature: string
  ) {
    if (
      this.webhookSecret &&
      this.configService.get<boolean>("WEBHOOK_VALIDATE_SIGNATURE")
    ) {
      const isValid = this.validateWebhookSignature(payload, signature);

      if (!isValid) {
        throw new HttpException(
          "Invalid webhook signature",
          HttpStatus.UNAUTHORIZED
        );
      }
    }

    console.log("Webhook received:", {
      event_type: payload.event_type,
      event_name: payload.event_name,
      event_uuid: payload.event_uuid || payload.transaction_uuid,
    });

    try {
      await this.webhookService.processWebhook(payload);

      return {
        status: "received",
        event_uuid: payload.event_uuid || payload.transaction_uuid,
      };
    } catch (error) {
      console.error("Error processing webhook:", error);

      return {
        status: "received_with_error",
        event_uuid: payload.event_uuid || payload.transaction_uuid,
        error: error.message,
      };
    }
  }

  private validateWebhookSignature(payload: any, signature: string): boolean {
    if (!signature || !this.webhookSecret) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest("hex");

    return signature === expectedSignature;
  }

  @Post("webhook/test")
  async testWebhook() {
    const testPayload = {
      event_type: "WEBHOOK.CONVERTED",
      event_uuid: "test-" + Date.now(),
      leads: [
        {
          email: "test@example.com",
          name: "Test Lead",
          tags: ["supplier", "test"],
          custom_fields: {
            cf_tipo: "supplier",
            cf_cpf_cnpj: "12345678901",
          },
        },
      ],
    };

    await this.webhookService.processWebhook(testPayload);

    return {
      message: "Test webhook processed",
      payload: testPayload,
    };
  }
}
