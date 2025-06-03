import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WebhookManagementService {
  private readonly logger = new Logger(WebhookManagementService.name);
  private readonly baseUrl = 'https://api.rd.services';
  private accessToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.accessToken = this.configService.get<string>('RD_STATION_ACCESS_TOKEN');
  }

  async createMarketingWebhooks(): Promise<void> {
    const webhookUrl = `${this.configService.get<string>('RD_STATION_CALLBACK_URL')}/rdstation/webhook`;
    
    try {
      const conversionWebhook = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/integrations/webhooks`,
          {
            webhook: {
              url: webhookUrl,
              event_type: 'WEBHOOK.CONVERTED',
              webhook_type: 'lead',
              include_relations: ['tags', 'custom_fields']
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      this.logger.log('Webhook de conversão criado:', conversionWebhook.data);

      const opportunityWebhook = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/integrations/webhooks`,
          {
            webhook: {
              url: webhookUrl,
              event_type: 'WEBHOOK.MARKED_OPPORTUNITY',
              webhook_type: 'lead',
              include_relations: ['tags', 'custom_fields']
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      this.logger.log('Webhook de oportunidade criado:', opportunityWebhook.data);

    } catch (error) {
      this.logger.error('Erro ao criar webhooks do Marketing:', error.response?.data || error);
      throw error;
    }
  }

  async createCRMWebhooks(): Promise<void> {
    const webhookUrl = `${this.configService.get<string>('RD_STATION_CALLBACK_URL')}/rdstation/webhook`;
    
    try {
      const dealWebhook = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/integrations/webhooks`,
          {
            webhook: {
              entity_type: 'deals',
              event_types: ['deal.created', 'deal.updated', 'deal.won', 'deal.lost'],
              url: webhookUrl,
              http_method: 'POST'
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      this.logger.log('Webhook de deals criado:', dealWebhook.data);

      const orgWebhook = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/integrations/webhooks`,
          {
            webhook: {
              entity_type: 'organizations',
              event_types: ['organization.created', 'organization.updated'],
              url: webhookUrl,
              http_method: 'POST'
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      this.logger.log('Webhook de organizations criado:', orgWebhook.data);

    } catch (error) {
      this.logger.error('Erro ao criar webhooks do CRM:', error.response?.data || error);
      throw error;
    }
  }

  async listWebhooks(): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/integrations/webhooks`,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`
            }
          }
        )
      );

      return response.data.webhooks || [];

    } catch (error) {
      this.logger.error('Erro ao listar webhooks:', error.response?.data || error);
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
              'Authorization': `Bearer ${this.accessToken}`
            }
          }
        )
      );

      this.logger.log(`Webhook ${webhookId} deletado com sucesso`);

    } catch (error) {
      this.logger.error('Erro ao deletar webhook:', error.response?.data || error);
      throw error;
    }
  }

  async setupAllWebhooks(): Promise<void> {
    this.logger.log('Configurando todos os webhooks...');
    
    try {
      const existingWebhooks = await this.listWebhooks();
      
      const hasConversionWebhook = existingWebhooks.some(w => 
        w.event_type === 'WEBHOOK.CONVERTED'
      );
      
      const hasOpportunityWebhook = existingWebhooks.some(w => 
        w.event_type === 'WEBHOOK.MARKED_OPPORTUNITY'
      );

      if (!hasConversionWebhook || !hasOpportunityWebhook) {
        await this.createMarketingWebhooks();
      } else {
        this.logger.log('Webhooks do Marketing já existem');
      }

      const hasDealWebhook = existingWebhooks.some(w => 
        w.entity_type === 'deals'
      );

      if (!hasDealWebhook) {
        await this.createCRMWebhooks();
      } else {
        this.logger.log('Webhooks do CRM já existem');
      }

      this.logger.log('Todos os webhooks configurados com sucesso!');

    } catch (error) {
      this.logger.error('Erro ao configurar webhooks:', error);
      throw error;
    }
  }
}