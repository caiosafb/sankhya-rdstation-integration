import { Controller, Post, Get, Query, Param } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('fornecedores')
  async syncFornecedores() {
    await this.syncService.syncFornecedores();
    return { message: 'Sincronização de fornecedores iniciada' };
  }

  @Post('pedidos-conversions')
  async syncPedidosAsConversions() {
    await this.syncService.syncPedidosAsConversions();
    return { message: 'Sincronização de pedidos como conversões iniciada' };
  }

  @Post('produtos-tags')
  async syncProdutosAsTags() {
    await this.syncService.syncProdutosAsTags();
    return { message: 'Sincronização de produtos como tags iniciada' };
  }

  @Post('fornecedores/:id')
  async syncSpecificFornecedor(@Param('id') id: string) {
    await this.syncService.syncSpecificFornecedor(parseInt(id));
    return { message: `Fornecedor ${id} sincronizado` };
  }

  @Get('history')
  async getSyncHistory(
    @Query('entityType') entityType?: string,
    @Query('status') status?: string,
  ) {
    return this.syncService.getSyncHistory(entityType, status);
  }

  @Post('all')
  async syncAll() {
    await Promise.all([
      this.syncService.syncFornecedores(),
      this.syncService.syncPedidosAsConversions(),
      this.syncService.syncProdutosAsTags(),
    ]);
    return { message: 'Sincronização completa iniciada' };
  }

  @Get('status')
  async getStatus() {
    const [total, success, error] = await Promise.all([
      this.syncService.getSyncHistory(),
      this.syncService.getSyncHistory(null, 'success'),
      this.syncService.getSyncHistory(null, 'error'),
    ]);

    return {
      total_syncs: total.length,
      successful: success.length,
      errors: error.length,
      last_sync: total[0]?.createdAt || null,
    };
  }
}
