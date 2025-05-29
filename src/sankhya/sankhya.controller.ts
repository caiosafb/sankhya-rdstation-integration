import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { SankhyaService } from "./sankhya.service";
import { CreateFornecedorDto, CreatePedidoDto } from "./dto";

@Controller("sankhya")
export class SankhyaController {
  constructor(private readonly sankhyaService: SankhyaService) {}

  @Get("fornecedores")
  async getFornecedores(@Query() filters: any) {
    return this.sankhyaService.getFornecedores(filters);
  }

  @Post("fornecedores")
  async createFornecedor(@Body() fornecedor: CreateFornecedorDto) {
    return this.sankhyaService.createFornecedor(fornecedor);
  }

  @Get("empresas")
  async getEmpresas(@Query() filters: any) {
    return this.sankhyaService.getEmpresas(filters);
  }

  @Get("produtos")
  async getProdutos(@Query() filters: any) {
    return this.sankhyaService.getProdutos(filters);
  }

  @Get("pedidos")
  async getPedidos(@Query() filters: any) {
    return this.sankhyaService.getPedidos(filters);
  }

  @Post("pedidos")
  async createPedido(@Body() pedido: CreatePedidoDto) {
    return this.sankhyaService.createPedido(pedido);
  }

  @Get("vendedores")
  async getVendedores(@Query() filters: any) {
    return this.sankhyaService.getVendedores(filters);
  }
}
