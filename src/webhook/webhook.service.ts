import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SankhyaService } from "../sankhya/sankhya.service";
import { RdStationService } from "../rd-station/rd-station.service";
import { SyncLog } from "../database/entities/sync-log.entity";
import { CreateFornecedorDto } from "../sankhya/dto";

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly sankhyaService: SankhyaService,
    private readonly rdStationService: RdStationService,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>
  ) {}

  async processWebhook(payload: any): Promise<void> {
    const syncLog = new SyncLog();
    syncLog.entityType = `webhook_${payload.event_type || payload.event_name}`;
    syncLog.entityId = payload.event_uuid || payload.transaction_uuid;
    syncLog.source = "rdstation_webhook";
    syncLog.destination = "sankhya";
    syncLog.data = payload;

    try {
      switch (payload.event_type) {
        case "WEBHOOK.CONVERTED":
          await this.handleConversionEvent(payload);
          break;

        case "WEBHOOK.MARKED_OPPORTUNITY":
          await this.handleMarkedOpportunityEvent(payload);
          break;
      }

      switch (payload.event_name) {
        case "crm_deal_created":
        case "crm_deal_updated":
          await this.handleDealEvent(payload);
          break;

        case "crm_deal_deleted":
          this.logger.log(`Deal deleted: ${payload.document?.id}`);
          break;

        case "crm_organization_created":
        case "crm_organization_updated":
          await this.handleOrganizationEvent(payload);
          break;

        default:
          if (!payload.event_type && !payload.event_name) {
            this.logger.warn(
              `Unknown webhook format: ${JSON.stringify(payload)}`
            );
          }
      }

      syncLog.status = "success";
    } catch (error) {
      syncLog.status = "error";
      syncLog.error = error.message;
      this.logger.error(
        `Failed to process webhook ${payload.event_uuid}`,
        error
      );
      throw error;
    } finally {
      await this.syncLogRepository.save(syncLog);
    }
  }

  private async handleConversionEvent(payload: any): Promise<void> {
    const lead = payload.leads?.[0] || payload;

    if (!lead || !lead.email) {
      this.logger.warn("Conversion webhook missing lead data");
      return;
    }

    const isFornecedor =
      lead.tags?.includes("fornecedor") ||
      lead.custom_fields?.cf_tipo === "fornecedor";

    if (isFornecedor && !lead.custom_fields?.cf_sankhya_id) {
      const fornecedorData: CreateFornecedorDto = {
        nome: lead.name || lead.email,
        email: lead.email,
        telefone: lead.personal_phone || lead.mobile_phone,
        cpfCnpj: lead.custom_fields?.cf_cpf_cnpj || "",
        tipo: this.detectTipoPessoa(lead.custom_fields?.cf_cpf_cnpj),
      };

      await this.sankhyaService.createFornecedor(fornecedorData);
      this.logger.log(
        `Created fornecedor in Sankhya from conversion: ${lead.email}`
      );
    }

    if (
      lead.conversion_identifier === "purchase" ||
      lead.conversion_identifier === "sale"
    ) {
      await this.createOrderFromConversion(lead);
    }
  }

  private async handleMarkedOpportunityEvent(payload: any): Promise<void> {
    const lead = payload.leads?.[0] || payload;

    if (!lead || !lead.email) {
      this.logger.warn("Marked opportunity webhook missing lead data");
      return;
    }

    this.logger.log(`Lead marked as opportunity: ${lead.email}`);

    await this.rdStationService.addTagsToContact(lead.email, [
      "oportunidade",
      "sankhya_sync",
    ]);
  }

  private async handleDealEvent(payload: any): Promise<void> {
    const deal = payload.document;

    if (!deal) {
      this.logger.warn("Deal webhook missing document data");
      return;
    }

    this.logger.log(`Processing deal ${payload.event_name}: ${deal.id}`);

    if (deal.deal_stage_id && deal.win === true) {
      const clienteId = await this.findOrCreateClienteFromDeal(deal);

      await this.sankhyaService.createPedido({
        clienteId: clienteId,
        empresaId: 1,
        vendedorId: deal.user_id ? 1 : 1,
        produtos: [
          {
            produtoId: 1,
            quantidade: 1,
            precoUnitario: deal.amount || 0,
          },
        ],
      });

      this.logger.log(`Created order in Sankhya from won deal: ${deal.id}`);
    }
  }

  private async handleOrganizationEvent(payload: any): Promise<void> {
    const organization = payload.document;

    if (!organization) {
      this.logger.warn("Organization webhook missing document data");
      return;
    }

    this.logger.log(
      `Processing organization ${payload.event_name}: ${organization.id}`
    );

    if (organization.name) {
      const fornecedorData: CreateFornecedorDto = {
        nome: organization.name,
        email: organization.email || `${organization.id}@rdstation.com`,
        telefone: organization.phone || "",
        cpfCnpj: organization.cnpj || "",
        tipo: organization.cnpj ? "J" : "F",
      };

      await this.sankhyaService.createFornecedor(fornecedorData);
      this.logger.log(`Synced organization to Sankhya: ${organization.name}`);
    }
  }

  private async createOrderFromConversion(lead: any): Promise<void> {
    try {
      const clienteId = await this.findOrCreateCliente(lead);

      if (lead.custom_fields?.cf_order_items) {
        const orderItems = JSON.parse(lead.custom_fields.cf_order_items);

        await this.sankhyaService.createPedido({
          clienteId: clienteId,
          empresaId: lead.custom_fields?.cf_empresa_id || 1,
          vendedorId: lead.custom_fields?.cf_vendedor_id || 1,
          produtos: orderItems.map((item: any) => ({
            produtoId: item.product_id,
            quantidade: item.quantity,
            precoUnitario: item.price,
          })),
        });
      } else if (lead.custom_fields?.cf_order_total_value) {
        await this.sankhyaService.createPedido({
          clienteId: clienteId,
          empresaId: 1,
          vendedorId: 1,
          produtos: [
            {
              produtoId: 1,
              quantidade: 1,
              precoUnitario: parseFloat(
                lead.custom_fields.cf_order_total_value
              ),
            },
          ],
        });
      }

      this.logger.log(`Created order from conversion: ${lead.email}`);
    } catch (error) {
      this.logger.error("Failed to create order from conversion", error);
    }
  }

  private async findOrCreateCliente(data: any): Promise<number> {
    const fornecedores = await this.sankhyaService.getFornecedores({
      EMAIL: data.email,
    });

    if (fornecedores.length > 0) {
      return fornecedores[0].id;
    }

    const novoCliente: CreateFornecedorDto = {
      nome: data.name || data.email,
      email: data.email,
      telefone: data.phone || data.mobile_phone,
      cpfCnpj: data.custom_fields?.cf_cpf_cnpj || "",
      tipo: this.detectTipoPessoa(data.custom_fields?.cf_cpf_cnpj),
    };

    await this.sankhyaService.createFornecedor(novoCliente);

    return 1;
  }

  private async findOrCreateClienteFromDeal(deal: any): Promise<number> {
    if (deal.contact_emails && deal.contact_emails.length > 0) {
      return this.findOrCreateCliente({
        email: deal.contact_emails[0],
        name: deal.name,
      });
    }

    if (deal.organization_id) {
      return 1;
    }

    return 1;
  }

  private detectTipoPessoa(cpfCnpj: string): string {
    if (!cpfCnpj) return "F";

    const numbers = cpfCnpj.replace(/\D/g, "");
    return numbers.length === 14 ? "J" : "F";
  }
}
