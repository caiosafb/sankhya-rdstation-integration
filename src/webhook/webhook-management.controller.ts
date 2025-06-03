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
      message: "Webhooks configurados com sucesso",
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
      message: `Webhook ${id} deletado com sucesso`,
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
          email: "teste@empresa.com.br",
          name: "Empresa Teste LTDA",
          personal_phone: "11999999999",
          tags: ["fornecedor", "teste"],
          custom_fields: {
            cf_tipo: "fornecedor",
            cf_cpf_cnpj: "12.345.678/0001-90",
          },
        },
      ],
    };

    const webhookUrl = `http://localhost:${process.env.PORT || 3000}/api/rdstation/webhook`;

    return {
      message: "Payload de teste enviado",
      url: webhookUrl,
      payload: testPayload,
    };
  }
}
