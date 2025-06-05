import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { SankhyaService } from "./sankhya.service";
import { CreateSupplierDto, CreateOrderDto } from "./dto";

@Controller("sankhya")
export class SankhyaController {
  constructor(private readonly sankhyaService: SankhyaService) {}

  @Get("suppliers")
  async getSuppliers(@Query() filters: any) {
    return this.sankhyaService.getSuppliers(filters);
  }

  @Post("suppliers")
  async createSupplier(@Body() supplier: CreateSupplierDto) {
    const supplierId = await this.sankhyaService.createSupplier(supplier);
    return {
      message: "Supplier created successfully",
      id: supplierId,
    };
  }

  @Get("companies")
  async getCompanies(@Query() filters: any) {
    return this.sankhyaService.getCompanies(filters);
  }

  @Get("products")
  async getProducts(@Query() filters: any) {
    return this.sankhyaService.getProducts(filters);
  }

  @Get("orders")
  async getOrders(@Query() filters: any) {
    return this.sankhyaService.getOrders(filters);
  }

  @Post("orders")
  async createOrder(@Body() order: CreateOrderDto) {
    const orderId = await this.sankhyaService.createOrder(order);
    return {
      message: "Order created successfully",
      id: orderId,
    };
  }

  @Get("sellers")
  async getSellers(@Query() filters: any) {
    return this.sankhyaService.getSellers(filters);
  }
}
