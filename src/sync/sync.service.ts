import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SankhyaService } from "../sankhya/sankhya.service";
import { RdStationService } from "../rd-station/rd-station.service";
import { SyncLog } from "../database/entities/sync-log.entity";

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly sankhyaService: SankhyaService,
    private readonly rdStationService: RdStationService,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async syncSuppliers() {
    this.logger.log("Starting suppliers sync...");

    try {
      const suppliers = await this.sankhyaService.getSuppliers();

      for (const supplier of suppliers) {
        if (!supplier.email) continue;

        const syncLog = new SyncLog();
        syncLog.entityType = "supplier";
        syncLog.entityId = supplier.id.toString();
        syncLog.source = "sankhya";
        syncLog.destination = "rdstation";
        syncLog.data = supplier;

        try {
          await this.rdStationService.createOrUpdateContact(supplier.email, {
            email: supplier.email,
            name: supplier.name,
            phone: supplier.phone,
            tags: ["supplier", "sankhya"],
            custom_fields: {
              cf_sankhya_id: supplier.id.toString(),
              cf_cpf_cnpj: supplier.taxId,
              cf_tipo: "supplier",
            },
          });

          syncLog.status = "success";
        } catch (error) {
          syncLog.status = "error";
          syncLog.error = error.message;
          this.logger.error(`Failed to sync supplier ${supplier.id}`, error);
        }

        await this.syncLogRepository.save(syncLog);
      }

      this.logger.log(`Synced ${suppliers.length} suppliers`);
    } catch (error) {
      this.logger.error("Suppliers sync failed", error);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncOrdersAsConversions() {
    this.logger.log("Starting orders to conversions sync...");

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const orders = await this.sankhyaService.getOrders({
        DTNEG: { $gte: yesterday.toISOString() },
      });

      for (const order of orders) {
        const syncLog = new SyncLog();
        syncLog.entityType = "order_conversion";
        syncLog.entityId = order.id.toString();
        syncLog.source = "sankhya";
        syncLog.destination = "rdstation";
        syncLog.data = order;

        try {
          const suppliers = await this.sankhyaService.getSuppliers({
            CODPARC: order.customerId,
          });

          if (suppliers.length > 0 && suppliers[0].email) {
            const customer = suppliers[0];

            await this.rdStationService.createConversion({
              email: customer.email,
              conversion_identifier: "purchase",
              name: customer.name,
              company_name: customer.name,
              phone: customer.phone,
              cf_order_id: order.id.toString(),
              cf_order_total_value: order.totalValue,
              cf_sankhya_id: customer.id.toString(),
            });

            await this.rdStationService.addTagsToContact(customer.email, [
              "customer",
              "purchased",
              `order_${order.movementType}`,
            ]);
          }

          syncLog.status = "success";
        } catch (error) {
          syncLog.status = "error";
          syncLog.error = error.message;
          this.logger.error(
            `Failed to sync order ${order.id} as conversion`,
            error
          );
        }

        await this.syncLogRepository.save(syncLog);
      }

      this.logger.log(`Synced ${orders.length} orders as conversions`);
    } catch (error) {
      this.logger.error("Orders conversion sync failed", error);
    }
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async syncProductsAsTags() {
    this.logger.log("Starting products sync as tags...");

    try {
      const products = await this.sankhyaService.getProducts({ ATIVO: "S" });

      const productTags = products.map((p) => `product_${p.code}`);

      for (const product of products) {
        const syncLog = new SyncLog();
        syncLog.entityType = "product_tag";
        syncLog.entityId = product.id.toString();
        syncLog.source = "sankhya";
        syncLog.destination = "rdstation";
        syncLog.data = {
          ...product,
          tag: `product_${product.code}`,
        };
        syncLog.status = "success";

        await this.syncLogRepository.save(syncLog);
      }

      this.logger.log(`Processed ${products.length} products as tags`);
    } catch (error) {
      this.logger.error("Products sync failed", error);
    }
  }

  async syncSpecificSupplier(sankhyaId: number): Promise<void> {
    const suppliers = await this.sankhyaService.getSuppliers({
      CODPARC: sankhyaId,
    });

    if (suppliers.length === 0) {
      throw new Error(`Supplier not found: ${sankhyaId}`);
    }

    const supplier = suppliers[0];
    if (!supplier.email) {
      throw new Error(`Supplier has no email: ${sankhyaId}`);
    }

    await this.rdStationService.createOrUpdateContact(supplier.email, {
      email: supplier.email,
      name: supplier.name,
      phone: supplier.phone,
      tags: ["supplier", "sankhya", "manual_sync"],
      custom_fields: {
        cf_sankhya_id: supplier.id.toString(),
        cf_cpf_cnpj: supplier.taxId,
        cf_tipo: "supplier",
      },
    });
  }

  async getSyncHistory(
    entityType?: string,
    status?: string
  ): Promise<SyncLog[]> {
    const query = this.syncLogRepository.createQueryBuilder("sync");

    if (entityType) {
      query.andWhere("sync.entityType = :entityType", { entityType });
    }

    if (status) {
      query.andWhere("sync.status = :status", { status });
    }

    return query.orderBy("sync.createdAt", "DESC").limit(100).getMany();
  }
}
