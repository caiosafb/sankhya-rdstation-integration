import { Controller, Post, Get, Delete, Param } from "@nestjs/common";
import { WebhookManagementService } from "./webhook-management.service";

@Controller("webhook-management")
export class WebhookManagementController {
  constructor(
    private readonly webhookManagementService: WebhookManagementService
  ) {}

  @Post("setup")
  async setupWebhooks() {
    await this.webhookManagementService.setupAllWebhooks();
    return {
      message: "Webhooks configured successfully",
      timestamp: new Date(),
    };
  }

  @Get("list")
  async listWebhooks() {
    const webhooks = await this.webhookManagementService.listWebhooks();
    return {
      total: webhooks.length,
      webhooks: webhooks.map((w) => ({
        id: w.uuid,
        type: w.event_type || w.entity_type,
        url: w.url,
        status: w.status,
        created_at: w.created_at,
      })),
    };
  }

  @Delete(":id")
  async deleteWebhook(@Param("id") id: string) {
    await this.webhookManagementService.deleteWebhook(id);
    return {
      message: `Webhook ${id} deleted successfully`,
    };
  }

  @Post("test-payload")
  async sendTestPayload() {
    const testPayload = {
      event_type: "WEBHOOK.CONVERTED",
      event_uuid: "test-" + Date.now(),
      event_timestamp: new Date().toISOString(),
      leads: [
        {
          uuid: "lead-test-123",
          email: "test@company.com",
          name: "Test Company Ltd",
          personal_phone: "11999999999",
          tags: ["supplier", "test"],
          conversion_identifier: "manual-test",
          custom_fields: {
            cf_tipo: "supplier",
            cf_cpf_cnpj: "12.345.678/0001-90",
            cf_order_total_value: "1500.00",
          },
        },
      ],
    };

    const webhookUrl = `http://localhost:${process.env.PORT || 3000}/rdstation/webhook`;

    return {
      message: "Test payload sent",
      url: webhookUrl,
      payload: testPayload,
    };
  }

  @Post("test-opportunity")
  async sendTestOpportunity() {
    const testPayload = {
      event_type: "WEBHOOK.MARKED_OPPORTUNITY",
      event_uuid: "test-opp-" + Date.now(),
      event_timestamp: new Date().toISOString(),
      leads: [
        {
          uuid: "lead-test-456",
          email: "opportunity@company.com",
          name: "Potential Customer Inc",
          personal_phone: "11888888888",
          tags: ["customer", "potential"],
          custom_fields: {
            cf_valor_oportunidade: "5000.00",
            cf_tipo: "customer",
          },
        },
      ],
    };

    const webhookUrl = `http://localhost:${process.env.PORT || 3000}/rdstation/webhook`;

    return {
      message: "Opportunity payload sent",
      url: webhookUrl,
      payload: testPayload,
    };
  }
}
