import { Controller, Post, Get, Query } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('fornecedores')
  async syncFornecedores() {
    await this.syncService.syncFornecedores();
    return { message: 'Sincronização de fornecedores iniciada' };
  }

  @Post('produtos')
  async syncProdutos() {
    await this.syncService.syncProdutos();
    return { message: 'Sincronização de produtos iniciada' };
  }

  @Get('history')
  async getSyncHistory(
    @Query('entityType') entityType?: string,
    @Query('status') status?: string,
  ) {
    return this.syncService.getSyncHistory(entityType, status);
  }
}
