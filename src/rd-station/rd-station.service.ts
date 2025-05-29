import { Injectable, Logger, HttpException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { firstValueFrom } from "rxjs";
import {
  ContactDto,
  CreateContactDto,
  UpdateContactDto,
  ConversionDto,
  CreateEventDto,
  WebhookDto,
} from "./dto";

@Injectable()
export class RdStationService {
  private readonly logger = new Logger(RdStationService.name);
  private readonly baseUrl = "https://api.rd.services";
  private accessToken: string;
  private refreshToken: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private requestCount = 0;
  private lastReset = Date.now();
  private tokenExpiresAt: Date;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectQueue("rd-station-queue") private rdQueue: Queue
  ) {
    this.accessToken = this.configService.get<string>(
      "RD_STATION_ACCESS_TOKEN"
    );
    this.refreshToken = this.configService.get<string>(
      "RD_STATION_REFRESH_TOKEN"
    );
    this.clientId = this.configService.get<string>("RD_STATION_CLIENT_ID");
    this.clientSecret = this.configService.get<string>(
      "RD_STATION_CLIENT_SECRET"
    );
    this.tokenExpiresAt = new Date(Date.now() + 86400 * 1000);
  }

  private async checkRateLimit() {
    const now = Date.now();
    if (now - this.lastReset > 60000) {
      this.requestCount = 0;
      this.lastReset = now;
    }

    if (this.requestCount >= 600) {
      throw new HttpException("Rate limit exceeded", 429);
    }

    this.requestCount++;
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.post("https://api.rd.services/auth/token", {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
        })
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiresAt = new Date(
        Date.now() + response.data.expires_in * 1000
      );

      this.logger.log("RD Station token refreshed successfully");
    } catch (error) {
      this.logger.error(
        "Failed to refresh RD Station token",
        error.response?.data
      );
      throw error;
    }
  }

  private async ensureValidToken(): Promise<void> {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

    if (this.tokenExpiresAt <= fiveMinutesFromNow) {
      await this.refreshAccessToken();
    }
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<any> {
    await this.checkRateLimit();
    await this.ensureValidToken();

    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint}`;

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url,
          data,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        })
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        this.logger.warn("Token invalid, forcing refresh...");
        await this.refreshAccessToken();

        const retryResponse = await firstValueFrom(
          this.httpService.request({
            method,
            url,
            data,
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json",
            },
          })
        );
        return retryResponse.data;
      }

      this.logger.error(
        `Request failed: ${method} ${endpoint}`,
        error.response?.data
      );
      throw error;
    }
  }

  async createOrUpdateContact(
    identifier: string,
    contact: CreateContactDto
  ): Promise<any> {
    const endpoint = `/platform/contacts/email:${encodeURIComponent(identifier)}`;

    const payload = {
      name: contact.name,
      phone: contact.phone,
      mobile_phone: contact.mobile_phone,
      city: contact.city,
      state: contact.state,
      tags: contact.tags,
      custom_fields: contact.custom_fields,
    };

    Object.keys(payload).forEach(
      (key) => payload[key] === undefined && delete payload[key]
    );

    try {
      const result = await this.makeRequest("PATCH", endpoint, payload);
      this.logger.log(`Contact created/updated: ${identifier}`);
      return result;
    } catch (error) {
      this.logger.error("Failed to create/update contact", error);
      throw error;
    }
  }

  async getContact(email: string): Promise<ContactDto | null> {
    try {
      const endpoint = `/platform/contacts/email:${encodeURIComponent(email)}`;
      const result = await this.makeRequest("GET", endpoint);

      return this.mapToContactDto(result);
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      this.logger.error(`Failed to get contact: ${email}`, error);
      throw error;
    }
  }

  async createConversion(conversion: ConversionDto): Promise<any> {
    const payload = {
      event_type: "CONVERSION",
      event_family: "CDP",
      payload: {
        conversion_identifier: conversion.conversion_identifier,
        email: conversion.email,
        name: conversion.name,
        job_title: conversion.job_title,
        company_name: conversion.company_name,
        phone: conversion.phone,
        mobile_phone: conversion.mobile_phone,
        cf_order_id: conversion.cf_order_id,
        cf_order_total_value: conversion.cf_order_total_value,
        cf_sankhya_id: conversion.cf_sankhya_id,
      },
    };

    try {
      const result = await this.makeRequest(
        "POST",
        "/platform/events",
        payload
      );
      this.logger.log(`Conversion created for: ${conversion.email}`);
      return result;
    } catch (error) {
      this.logger.error("Failed to create conversion", error);
      throw error;
    }
  }

  async createEvent(event: CreateEventDto): Promise<any> {
    const payload = {
      event_type: event.event_type,
      event_family: event.event_family,
      payload: event.payload,
    };

    try {
      const result = await this.makeRequest(
        "POST",
        "/platform/events",
        payload
      );
      this.logger.log(`Event created: ${event.event_type}`);
      return result;
    } catch (error) {
      this.logger.error("Failed to create event", error);
      throw error;
    }
  }

  async updateContactTags(email: string, tags: string[]): Promise<any> {
    const endpoint = `/platform/contacts/email:${encodeURIComponent(email)}`;

    const payload = {
      tags: tags,
    };

    try {
      const result = await this.makeRequest("PATCH", endpoint, payload);
      this.logger.log(`Tags updated for contact: ${email}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to update tags for contact: ${email}`, error);
      throw error;
    }
  }

  async addTagsToContact(email: string, tags: string[]): Promise<any> {
    try {
      const contact = await this.getContact(email);
      if (!contact) {
        throw new Error(`Contact not found: ${email}`);
      }

      const currentTags = contact.tags || [];
      const newTags = [...new Set([...currentTags, ...tags])];

      return this.updateContactTags(email, newTags);
    } catch (error) {
      this.logger.error(`Failed to add tags to contact: ${email}`, error);
      throw error;
    }
  }

  async processContactQueue(contact: CreateContactDto): Promise<any> {
    try {
      return await this.createOrUpdateContact(contact.email, contact);
    } catch (error) {
      this.logger.error("Failed to process contact from queue", error);
      throw error;
    }
  }

  private mapToContactDto(data: any): ContactDto {
    return {
      uuid: data.uuid,
      email: data.email,
      name: data.name,
      phone: data.phone,
      mobile_phone: data.mobile_phone,
      city: data.city,
      state: data.state,
      tags: data.tags,
      custom_fields: data.custom_fields,
    };
  }
}
