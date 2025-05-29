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
  async syncFornecedores() {
    this.logger.log("Starting fornecedores sync...");

    try {
      const fornecedores = await this.sankhyaService.getFornecedores();

      for (const fornecedor of fornecedores) {
        if (!fornecedor.email) continue;

        const syncLog = new SyncLog();
        syncLog.entityType = "fornecedor";
        syncLog.entityId = fornecedor.id.toString();
        syncLog.source = "sankhya";
        syncLog.destination = "rdstation";
        syncLog.data = fornecedor;

        try {
          await this.rdStationService.createOrUpdateContact(fornecedor.email, {
            email: fornecedor.email,
            name: fornecedor.nome,
            phone: fornecedor.telefone,
            tags: ["fornecedor", "sankhya"],
            custom_fields: {
              cf_sankhya_id: fornecedor.id.toString(),
              cf_cpf_cnpj: fornecedor.cpfCnpj,
              cf_tipo: "fornecedor",
            },
          });

          syncLog.status = "success";
        } catch (error) {
          syncLog.status = "error";
          syncLog.error = error.message;
          this.logger.error(
            `Failed to sync fornecedor ${fornecedor.id}`,
            error
          );
        }

        await this.syncLogRepository.save(syncLog);
      }

      this.logger.log(`Synced ${fornecedores.length} fornecedores`);
    } catch (error) {
      this.logger.error("Fornecedores sync failed", error);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncPedidosAsConversions() {
    this.logger.log("Starting pedidos to conversions sync...");

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const pedidos = await this.sankhyaService.getPedidos({
        DTNEG: { $gte: yesterday.toISOString() },
      });

      for (const pedido of pedidos) {
        const syncLog = new SyncLog();
        syncLog.entityType = "pedido_conversion";
        syncLog.entityId = pedido.id.toString();
        syncLog.source = "sankhya";
        syncLog.destination = "rdstation";
        syncLog.data = pedido;

        try {
          const fornecedores = await this.sankhyaService.getFornecedores({
            CODPARC: pedido.clienteId,
          });

          if (fornecedores.length > 0 && fornecedores[0].email) {
            const cliente = fornecedores[0];

            await this.rdStationService.createConversion({
              email: cliente.email,
              conversion_identifier: "purchase",
              name: cliente.nome,
              company_name: cliente.nome,
              phone: cliente.telefone,
              cf_order_id: pedido.id.toString(),
              cf_order_total_value: pedido.valorTotal,
              cf_sankhya_id: cliente.id.toString(),
            });

            await this.rdStationService.addTagsToContact(cliente.email, [
              "cliente",
              "comprou",
              `pedido_${pedido.tipoMovimento}`,
            ]);
          }

          syncLog.status = "success";
        } catch (error) {
          syncLog.status = "error";
          syncLog.error = error.message;
          this.logger.error(
            `Failed to sync pedido ${pedido.id} as conversion`,
            error
          );
        }

        await this.syncLogRepository.save(syncLog);
      }

      this.logger.log(`Synced ${pedidos.length} pedidos as conversions`);
    } catch (error) {
      this.logger.error("Pedidos conversion sync failed", error);
    }
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async syncProdutosAsTags() {
    this.logger.log("Starting produtos sync as tags...");

    try {
      const produtos = await this.sankhyaService.getProdutos({ ATIVO: "S" });

      const produtoTags = produtos.map((p) => `produto_${p.codigo}`);

      for (const produto of produtos) {
        const syncLog = new SyncLog();
        syncLog.entityType = "produto_tag";
        syncLog.entityId = produto.id.toString();
        syncLog.source = "sankhya";
        syncLog.destination = "rdstation";
        syncLog.data = {
          ...produto,
          tag: `produto_${produto.codigo}`,
        };
        syncLog.status = "success";

        await this.syncLogRepository.save(syncLog);
      }

      this.logger.log(`Processed ${produtos.length} produtos as tags`);
    } catch (error) {
      this.logger.error("Produtos sync failed", error);
    }
  }

  async syncSpecificFornecedor(sankhyaId: number): Promise<void> {
    const fornecedores = await this.sankhyaService.getFornecedores({
      CODPARC: sankhyaId,
    });

    if (fornecedores.length === 0) {
      throw new Error(`Fornecedor not found: ${sankhyaId}`);
    }

    const fornecedor = fornecedores[0];
    if (!fornecedor.email) {
      throw new Error(`Fornecedor has no email: ${sankhyaId}`);
    }

    await this.rdStationService.createOrUpdateContact(fornecedor.email, {
      email: fornecedor.email,
      name: fornecedor.nome,
      phone: fornecedor.telefone,
      tags: ["fornecedor", "sankhya", "sync_manual"],
      custom_fields: {
        cf_sankhya_id: fornecedor.id.toString(),
        cf_cpf_cnpj: fornecedor.cpfCnpj,
        cf_tipo: "fornecedor",
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
