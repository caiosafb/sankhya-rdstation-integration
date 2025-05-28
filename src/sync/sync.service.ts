import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SankhyaService } from '../sankhya/sankhya.service';
import { RdStationService } from '../rd-station/rd-station.service';
import { SyncLog } from '../database/entities/sync-log.entity';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly sankhyaService: SankhyaService,
    private readonly rdStationService: RdStationService,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async syncFornecedores() {
    this.logger.log('Starting fornecedores sync...');
    
    try {
      const fornecedores = await this.sankhyaService.getFornecedores();
      
      for (const fornecedor of fornecedores) {
        if (!fornecedor.email) continue;

        const syncLog = new SyncLog();
        syncLog.entityType = 'fornecedor';
        syncLog.entityId = fornecedor.id.toString();
        syncLog.source = 'sankhya';
        syncLog.destination = 'rdstation';
        syncLog.data = fornecedor;

        try {
          const existingContact = await this.rdStationService.getContact(fornecedor.email);
          
          if (existingContact) {
            await this.rdStationService.updateContact(existingContact.id, {
              name: fornecedor.nome,
              phones: [{ phone: fornecedor.telefone }],
              custom_fields: {
                cf_sankhya_id: fornecedor.id,
                cf_cpf_cnpj: fornecedor.cpfCnpj,
                cf_tipo: 'fornecedor',
              },
            });
          } else {
            await this.rdStationService.createContact({
              name: fornecedor.nome,
              emails: [{ email: fornecedor.email }],
              phones: [{ phone: fornecedor.telefone }],
              custom_fields: {
                cf_sankhya_id: fornecedor.id,
                cf_cpf_cnpj: fornecedor.cpfCnpj,
                cf_tipo: 'fornecedor',
              },
            });
          }
          
          syncLog.status = 'success';
        } catch (error) {
          syncLog.status = 'error';
          syncLog.error = error.message;
          this.logger.error(`Failed to sync fornecedor ${fornecedor.id}`, error);
        }

        await this.syncLogRepository.save(syncLog);
      }

      this.logger.log(`Synced ${fornecedores.length} fornecedores`);
    } catch (error) {
      this.logger.error('Fornecedores sync failed', error);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncProdutos() {
    this.logger.log('Starting produtos sync...');
    
    try {
      const produtos = await this.sankhyaService.getProdutos({ ATIVO: 'S' });
      
      for (const produto of produtos) {
        const syncLog = new SyncLog();
        syncLog.entityType = 'produto';
        syncLog.entityId = produto.id.toString();
        syncLog.source = 'sankhya';
        syncLog.destination = 'rdstation';
        syncLog.data = produto;

        try {
          await this.rdStationService.createProduct({
            nome: produto.nome,
            codigo: produto.codigo,
            preco: produto.preco,
            sankhyaId: produto.id.toString(),
          });
          
          syncLog.status = 'success';
        } catch (error) {
          syncLog.status = 'error';
          syncLog.error = error.message;
          this.logger.error(`Failed to sync produto ${produto.id}`, error);
        }

        await this.syncLogRepository.save(syncLog);
      }

      this.logger.log(`Synced ${produtos.length} produtos`);
    } catch (error) {
      this.logger.error('Produtos sync failed', error);
    }
  }

  async getSyncHistory(entityType?: string, status?: string): Promise<SyncLog[]> {
    const query = this.syncLogRepository.createQueryBuilder('sync');
    
    if (entityType) {
      query.andWhere('sync.entityType = :entityType', { entityType });
    }
    
    if (status) {
      query.andWhere('sync.status = :status', { status });
    }
    
    return query.orderBy('sync.createdAt', 'DESC').limit(100).getMany();
  }
}
