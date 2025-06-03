import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

async function createWebhook() {
  const accessToken = process.env.RD_STATION_ACCESS_TOKEN;
  const webhookUrl = process.env.RD_STATION_CALLBACK_URL + "/rdstation/webhook";

  try {
    const conversionWebhook = await axios.post(
      "https://api.rd.services/integrations/webhooks",
      {
        webhook: {
          url: webhookUrl,
          event_type: "WEBHOOK.CONVERTED",
          webhook_type: "lead",
          include_relations: ["tags", "custom_fields"],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Webhook de conversão criado:", conversionWebhook.data);

    const opportunityWebhook = await axios.post(
      "https://api.rd.services/integrations/webhooks",
      {
        webhook: {
          url: webhookUrl,
          event_type: "WEBHOOK.MARKED_OPPORTUNITY",
          webhook_type: "lead",
          include_relations: ["tags", "custom_fields"],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Webhook de oportunidade criado:", opportunityWebhook.data);

    const dealWebhook = await axios.post(
      "https://api.rd.services/integrations/webhooks",
      {
        webhook: {
          entity_type: "deals",
          event_types: ["deal.created", "deal.updated", "deal.won"],
          url: webhookUrl,
          http_method: "POST",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Webhook de negociações criado:", dealWebhook.data);
  } catch (error) {
    console.error(
      "Erro ao criar webhook:",
      error.response?.data || error.message
    );
  }
}

async function listWebhooks() {
  const accessToken = process.env.RD_STATION_ACCESS_TOKEN;

  try {
    const response = await axios.get(
      "https://api.rd.services/integrations/webhooks",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log("Webhooks existentes:");
    response.data.webhooks.forEach((webhook: any, index: number) => {
      console.log(
        `\n${index + 1}. ${webhook.event_type || webhook.entity_type}`
      );
      console.log(`   URL: ${webhook.url}`);
      console.log(`   ID: ${webhook.uuid}`);
      console.log(`   Status: ${webhook.status}`);
    });
  } catch (error) {
    console.error(
      "Erro ao listar webhooks:",
      error.response?.data || error.message
    );
  }
}

async function deleteWebhook(webhookId: string) {
  const accessToken = process.env.RD_STATION_ACCESS_TOKEN;

  try {
    await axios.delete(
      `https://api.rd.services/integrations/webhooks/${webhookId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log(`Webhook ${webhookId} deletado com sucesso`);
  } catch (error) {
    console.error(
      "Erro ao deletar webhook:",
      error.response?.data || error.message
    );
  }
}

const command = process.argv[2];

switch (command) {
  case "create":
    createWebhook();
    break;
  case "list":
    listWebhooks();
    break;
  case "delete":
    const webhookId = process.argv[3];
    if (!webhookId) {
      console.error("Por favor, forneça o ID do webhook para deletar");
      console.log("Uso: npm run webhook:delete <webhook-id>");
    } else {
      deleteWebhook(webhookId);
    }
    break;
  default:
    console.log("Comandos disponíveis:");
    console.log("  npm run webhook:create - Criar webhooks");
    console.log("  npm run webhook:list   - Listar webhooks");
    console.log("  npm run webhook:delete <id> - Deletar webhook");
}
