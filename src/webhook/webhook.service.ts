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
    syncLog.entityType = `webhook_${payload.event_type}`;
    syncLog.entityId = payload.event_uuid;
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

        default:
          this.logger.warn(`Tipo de evento não tratado: ${payload.event_type}`);
      }

      syncLog.status = "success";
    } catch (error) {
      syncLog.status = "error";
      syncLog.error = error.message;
      this.logger.error(
        `Falha ao processar webhook ${payload.event_uuid}`,
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
      this.logger.warn("Webhook de conversão sem dados do lead");
      return;
    }

    this.logger.log(
      `Processando conversão: ${lead.email} - ${lead.conversion_identifier || "sem identificador"}`
    );

    const isFornecedor =
      lead.tags?.includes("fornecedor") ||
      lead.custom_fields?.cf_tipo === "fornecedor";

    if (isFornecedor && !lead.custom_fields?.cf_sankhya_id) {
      const fornecedorData: CreateFornecedorDto = {
        nome: lead.name || lead.email,
        email: lead.email,
        telefone: lead.personal_phone || lead.mobile_phone || "",
        cpfCnpj: lead.custom_fields?.cf_cpf_cnpj || "",
        tipo: this.detectTipoPessoa(lead.custom_fields?.cf_cpf_cnpj),
      };

      await this.sankhyaService.createFornecedor(fornecedorData);
      this.logger.log(
        `Fornecedor criado no Sankhya a partir da conversão: ${lead.email}`
      );
    }

    if (
      lead.conversion_identifier === "purchase" ||
      lead.conversion_identifier === "sale" ||
      lead.conversion_identifier === "venda"
    ) {
      await this.createOrderFromConversion(lead);
    }
  }

  private async handleMarkedOpportunityEvent(payload: any): Promise<void> {
    const lead = payload.leads?.[0] || payload;

    if (!lead || !lead.email) {
      this.logger.warn("Webhook de oportunidade sem dados do lead");
      return;
    }

    this.logger.log(`Lead marcado como oportunidade: ${lead.email}`);

    try {
      await this.rdStationService.addTagsToContact(lead.email, [
        "oportunidade",
        "sankhya_sync",
      ]);

      if (lead.custom_fields?.cf_valor_oportunidade) {
        await this.createOrderFromOpportunity(lead);
      }
    } catch (error) {
      this.logger.error(`Erro ao processar oportunidade: ${lead.email}`, error);
    }
  }

  private async createOrderFromConversion(lead: any): Promise<void> {
    try {
      const clienteId = await this.findOrCreateCliente(lead);

      if (lead.custom_fields?.cf_order_items) {
        try {
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

          this.logger.log(`Pedido criado a partir da conversão: ${lead.email}`);
        } catch (parseError) {
          this.logger.error("Erro ao parsear itens do pedido", parseError);
        }
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

        this.logger.log(
          `Pedido genérico criado a partir da conversão: ${lead.email}`
        );
      }
    } catch (error) {
      this.logger.error("Falha ao criar pedido a partir da conversão", error);
    }
  }

  private async createOrderFromOpportunity(lead: any): Promise<void> {
    try {
      const clienteId = await this.findOrCreateCliente(lead);
      const valorOportunidade = parseFloat(
        lead.custom_fields.cf_valor_oportunidade
      );

      if (valorOportunidade > 0) {
        await this.sankhyaService.createPedido({
          clienteId: clienteId,
          empresaId: 1,
          vendedorId: 1,
          produtos: [
            {
              produtoId: 1,
              quantidade: 1,
              precoUnitario: valorOportunidade,
            },
          ],
        });

        this.logger.log(
          `Pedido criado a partir da oportunidade: ${lead.email} - Valor: ${valorOportunidade}`
        );
      }
    } catch (error) {
      this.logger.error(
        "Falha ao criar pedido a partir da oportunidade",
        error
      );
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
      telefone: data.phone || data.mobile_phone || "",
      cpfCnpj: data.custom_fields?.cf_cpf_cnpj || "",
      tipo: this.detectTipoPessoa(data.custom_fields?.cf_cpf_cnpj),
    };

    await this.sankhyaService.createFornecedor(novoCliente);

    return 1;
  }

  private detectTipoPessoa(cpfCnpj: string): string {
    if (!cpfCnpj) return "F";

    const numbers = cpfCnpj.replace(/\D/g, "");
    return numbers.length === 14 ? "J" : "F";
  }
}
