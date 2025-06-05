import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SankhyaService } from "../sankhya/sankhya.service";
import { RdStationService } from "../rd-station/rd-station.service";
import { SyncLog } from "../database/entities/sync-log.entity";
import { CreateSupplierDto } from "../sankhya/dto";

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
          this.logger.warn(`Unhandled event type: ${payload.event_type}`);
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

    this.logger.log(
      `Processing conversion: ${lead.email} - ${lead.conversion_identifier || "no identifier"}`
    );

    const isSupplier =
      lead.tags?.includes("supplier") ||
      lead.custom_fields?.cf_tipo === "supplier";

    if (isSupplier && !lead.custom_fields?.cf_sankhya_id) {
      try {
        const supplierData: CreateSupplierDto = {
          name: lead.name || lead.email,
          email: lead.email,
          phone: lead.personal_phone || lead.mobile_phone || "",
          taxId: lead.custom_fields?.cf_cpf_cnpj || "",
          type: this.detectPersonType(lead.custom_fields?.cf_cpf_cnpj),
        };

        const sankhyaId =
          await this.sankhyaService.createSupplier(supplierData);
        this.logger.log(`Supplier created in Sankhya. ID: ${sankhyaId}`);

        if (sankhyaId) {
          await this.rdStationService.createOrUpdateContact(lead.email, {
            email: lead.email,
            custom_fields: {
              cf_sankhya_id: sankhyaId.toString(),
            },
          });
          this.logger.log(
            `Contact updated in RD Station with Sankhya ID: ${sankhyaId}`
          );
        }
      } catch (error) {
        this.logger.error(`Error creating supplier: ${lead.email}`, error);
        throw error;
      }
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
      this.logger.warn("Opportunity webhook missing lead data");
      return;
    }

    this.logger.log(`Lead marked as opportunity: ${lead.email}`);

    try {
      await this.rdStationService.addTagsToContact(lead.email, [
        "opportunity",
        "sankhya_sync",
      ]);

      if (lead.custom_fields?.cf_valor_oportunidade) {
        await this.createOrderFromOpportunity(lead);
      }
    } catch (error) {
      this.logger.error(`Error processing opportunity: ${lead.email}`, error);
    }
  }

  private async createOrderFromConversion(lead: any): Promise<void> {
    try {
      const customerId = await this.findOrCreateCustomer(lead);

      if (lead.custom_fields?.cf_order_items) {
        try {
          const orderItems = JSON.parse(lead.custom_fields.cf_order_items);

          const orderId = await this.sankhyaService.createOrder({
            customerId: customerId,
            companyId: lead.custom_fields?.cf_empresa_id || 1,
            sellerId: lead.custom_fields?.cf_vendedor_id || 1,
            items: orderItems.map((item: any) => ({
              productId: item.product_id,
              quantity: item.quantity,
              unitPrice: item.price,
            })),
          });

          this.logger.log(`Order created in Sankhya. NUNOTA: ${orderId}`);
        } catch (parseError) {
          this.logger.error("Error parsing order items", parseError);
        }
      } else if (lead.custom_fields?.cf_order_total_value) {
        const orderId = await this.sankhyaService.createOrder({
          customerId: customerId,
          companyId: 1,
          sellerId: 1,
          items: [
            {
              productId: 1,
              quantity: 1,
              unitPrice: parseFloat(lead.custom_fields.cf_order_total_value),
            },
          ],
        });

        this.logger.log(`Generic order created in Sankhya. NUNOTA: ${orderId}`);
      }
    } catch (error) {
      this.logger.error("Failed to create order from conversion", error);
    }
  }

  private async createOrderFromOpportunity(lead: any): Promise<void> {
    try {
      const customerId = await this.findOrCreateCustomer(lead);
      const opportunityValue = parseFloat(
        lead.custom_fields.cf_valor_oportunidade
      );

      if (opportunityValue > 0) {
        const orderId = await this.sankhyaService.createOrder({
          customerId: customerId,
          companyId: 1,
          sellerId: 1,
          items: [
            {
              productId: 1,
              quantity: 1,
              unitPrice: opportunityValue,
            },
          ],
        });

        this.logger.log(
          `Order created from opportunity. NUNOTA: ${orderId} - Value: ${opportunityValue}`
        );
      }
    } catch (error) {
      this.logger.error("Failed to create order from opportunity", error);
    }
  }

  private async findOrCreateCustomer(data: any): Promise<number> {
    try {
      const suppliers = await this.sankhyaService.getSuppliers({
        EMAIL: data.email,
      });

      if (suppliers.length > 0) {
        return suppliers[0].id;
      }
    } catch (error) {
      this.logger.warn(`Error searching supplier: ${data.email}`, error);
    }

    const newCustomer: CreateSupplierDto = {
      name: data.name || data.email,
      email: data.email,
      phone: data.phone || data.mobile_phone || "",
      taxId: data.custom_fields?.cf_cpf_cnpj || "",
      type: this.detectPersonType(data.custom_fields?.cf_cpf_cnpj),
    };

    try {
      const customerId = await this.sankhyaService.createSupplier(newCustomer);
      return customerId;
    } catch (error) {
      this.logger.error("Error creating customer", error);
      return 1;
    }
  }

  private detectPersonType(taxId: string): string {
    if (!taxId) return "F";

    const numbers = taxId.replace(/\D/g, "");
    return numbers.length === 14 ? "J" : "F";
  }
}
