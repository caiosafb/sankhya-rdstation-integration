import { Controller, Post, Get, Query, Param } from "@nestjs/common";
import { SyncService } from "./sync.service";

@Controller("sync")
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post("suppliers")
  async syncSuppliers() {
    await this.syncService.syncSuppliers();
    return { message: "Suppliers synchronization started" };
  }

  @Post("orders-conversions")
  async syncOrdersAsConversions() {
    await this.syncService.syncOrdersAsConversions();
    return { message: "Orders to conversions synchronization started" };
  }

  @Post("products-tags")
  async syncProductsAsTags() {
    await this.syncService.syncProductsAsTags();
    return { message: "Products as tags synchronization started" };
  }

  @Post("suppliers/:id")
  async syncSpecificSupplier(@Param("id") id: string) {
    await this.syncService.syncSpecificSupplier(parseInt(id));
    return { message: `Supplier ${id} synchronized` };
  }

  @Get("history")
  async getSyncHistory(
    @Query("entityType") entityType?: string,
    @Query("status") status?: string
  ) {
    return this.syncService.getSyncHistory(entityType, status);
  }

  @Post("all")
  async syncAll() {
    await Promise.all([
      this.syncService.syncSuppliers(),
      this.syncService.syncOrdersAsConversions(),
      this.syncService.syncProductsAsTags(),
    ]);
    return { message: "Complete synchronization started" };
  }

  @Get("status")
  async getStatus() {
    const [total, success, error] = await Promise.all([
      this.syncService.getSyncHistory(),
      this.syncService.getSyncHistory(null, "success"),
      this.syncService.getSyncHistory(null, "error"),
    ]);

    return {
      total_syncs: total.length,
      successful: success.length,
      errors: error.length,
      last_sync: total[0]?.createdAt || null,
    };
  }
}
