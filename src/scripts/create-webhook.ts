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
        entity_type: "LEADS",
        event_type: "WEBHOOK.CONVERTED",
        url: webhookUrl,
        http_method: "POST",
        include_relations: ["TAGS", "FIELDS"],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Conversion webhook created:", conversionWebhook.data);

    const opportunityWebhook = await axios.post(
      "https://api.rd.services/integrations/webhooks",
      {
        entity_type: "LEADS",
        event_type: "WEBHOOK.MARKED_OPPORTUNITY",
        url: webhookUrl,
        http_method: "POST",
        include_relations: ["TAGS", "FIELDS"],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Opportunity webhook created:", opportunityWebhook.data);
  } catch (error) {
    console.error(
      "Error creating webhook:",
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

    console.log("Existing webhooks:");
    console.log("Total:", response.data.webhooks.length);

    response.data.webhooks.forEach((webhook: any, index: number) => {
      console.log(`\n${index + 1}. ${webhook.event_type}`);
      console.log(`   URL: ${webhook.url}`);
      console.log(`   ID: ${webhook.uuid}`);
      console.log(`   Status: ${webhook.status || "active"}`);
      console.log(`   Created at: ${webhook.created_at}`);
    });
  } catch (error) {
    console.error(
      "Error listing webhooks:",
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

    console.log(`Webhook ${webhookId} deleted successfully`);
  } catch (error) {
    console.error(
      "Error deleting webhook:",
      error.response?.data || error.message
    );
  }
}

async function testWebhook() {
  const webhookUrl = process.env.RD_STATION_CALLBACK_URL + "/rdstation/webhook";

  console.log(`Sending test payload to: ${webhookUrl}`);

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
        },
      },
    ],
  };

  try {
    const response = await axios.post(webhookUrl, testPayload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("Test sent successfully:", response.data);
  } catch (error) {
    console.error(
      "Error testing webhook:",
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
      console.error("Please provide webhook ID to delete");
      console.log("Usage: npm run webhook:delete <webhook-id>");
    } else {
      deleteWebhook(webhookId);
    }
    break;
  case "test":
    testWebhook();
    break;
  default:
    console.log("Available commands:");
    console.log("  npm run webhook:create - Create webhooks");
    console.log("  npm run webhook:list   - List webhooks");
    console.log("  npm run webhook:delete <id> - Delete webhook");
    console.log("  npm run webhook:test   - Test webhook locally");
}
