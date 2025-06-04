import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";

@Injectable()
export class WebhookManagementService {
  private readonly logger = new Logger(WebhookManagementService.name);
  private readonly baseUrl = "https://api.rd.services";
  private accessToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.accessToken = this.configService.get<string>(
      "RD_STATION_ACCESS_TOKEN"
    );
  }

  async createMarketingWebhooks(): Promise<void> {
    const webhookUrl = `${this.configService.get<string>("RD_STATION_CALLBACK_URL")}/rdstation/webhook`;

    try {
      const conversionWebhook = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/integrations/webhooks`,
          {
            entity_type: "LEADS",
            event_type: "WEBHOOK.CONVERTED",
            url: webhookUrl,
            http_method: "POST",
            include_relations: ["TAGS", "FIELDS"],
          },
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json",
            },
          }
        )
      );

      this.logger.log("Webhook de conversão criado:", conversionWebhook.data);

      const opportunityWebhook = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/integrations/webhooks`,
          {
            entity_type: "LEADS",
            event_type: "WEBHOOK.MARKED_OPPORTUNITY",
            url: webhookUrl,
            http_method: "POST",
            include_relations: ["TAGS", "FIELDS"],
          },
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json",
            },
          }
        )
      );

      this.logger.log(
        "Webhook de oportunidade criado:",
        opportunityWebhook.data
      );
    } catch (error) {
      this.logger.error(
        "Erro ao criar webhooks:",
        error.response?.data || error
      );
      throw error;
    }
  }

  async listWebhooks(): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/integrations/webhooks`, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        })
      );

      return response.data.webhooks || [];
    } catch (error) {
      this.logger.error(
        "Erro ao listar webhooks:",
        error.response?.data || error
      );
      throw error;
    }
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.baseUrl}/integrations/webhooks/${webhookId}`,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
          }
        )
      );

      this.logger.log(`Webhook ${webhookId} deletado com sucesso`);
    } catch (error) {
      this.logger.error(
        "Erro ao deletar webhook:",
        error.response?.data || error
      );
      throw error;
    }
  }

  async setupAllWebhooks(): Promise<void> {
    this.logger.log("Configurando webhooks do RD Station Marketing...");

    try {
      const existingWebhooks = await this.listWebhooks();

      const webhookUrl = `${this.configService.get<string>("RD_STATION_CALLBACK_URL")}/rdstation/webhook`;

      const hasConversionWebhook = existingWebhooks.some(
        (w) => w.event_type === "WEBHOOK.CONVERTED" && w.url === webhookUrl
      );

      const hasOpportunityWebhook = existingWebhooks.some(
        (w) =>
          w.event_type === "WEBHOOK.MARKED_OPPORTUNITY" && w.url === webhookUrl
      );

      if (!hasConversionWebhook || !hasOpportunityWebhook) {
        await this.createMarketingWebhooks();
        this.logger.log("Webhooks criados com sucesso!");
      } else {
        this.logger.log("Webhooks já existem para esta URL");
      }

      const allWebhooks = await this.listWebhooks();
      this.logger.log(`Total de webhooks configurados: ${allWebhooks.length}`);
    } catch (error) {
      this.logger.error("Erro ao configurar webhooks:", error);
      throw error;
    }
  }
}
