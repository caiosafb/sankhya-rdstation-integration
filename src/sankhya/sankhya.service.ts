import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { firstValueFrom } from "rxjs";
import {
  FornecedorDto,
  EmpresaDto,
  ProdutoDto,
  PedidoDto,
  VendedorDto,
  CreateFornecedorDto,
  CreatePedidoDto,
} from "./dto";

@Injectable()
export class SankhyaService {
  private readonly logger = new Logger(SankhyaService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly apiKey: string;
  private sessionId: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectQueue("sankhya-queue") private sankhyaQueue: Queue
  ) {
    this.baseUrl = this.configService.get<string>("SANKHYA_BASE_URL");
    this.token = this.configService.get<string>("SANKHYA_TOKEN");
    this.apiKey = this.configService.get<string>("SANKHYA_API_KEY");
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/service.sbr`,
          {
            serviceName: "MobileLoginSP.login",
            requestBody: {
              NOMUSU: this.configService.get<string>("SANKHYA_USERNAME"),
              INTERNO: this.configService.get<string>("SANKHYA_PASSWORD"),
            },
          },
          {
            headers: {
              Authorization: `Bearer ${this.token}`,
              token: this.apiKey,
              "Content-Type": "application/json",
            },
          }
        )
      );

      this.sessionId = response.data.responseBody.jsessionid;
      this.logger.log("Sankhya authentication successful");
    } catch (error) {
      this.logger.error(
        "Sankhya authentication failed",
        error.response?.data || error
      );
      throw error;
    }
  }

  async getFornecedores(filters?: any): Promise<FornecedorDto[]> {
    await this.ensureAuthenticated();

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/service.sbr`,
        {
          serviceName: "CRUDServiceProvider.loadRecords",
          requestBody: {
            dataSet: {
              rootEntity: "Parceiro",
              includePresentationFields: "S",
              criteria: {
                expression: {
                  $: "FORNECEDOR = 'S'",
                  ...filters,
                },
              },
            },
          },
        },
        this.getHeaders()
      )
    );

    return response.data.responseBody.entities.map(this.mapToFornecedorDto);
  }

  async createFornecedor(fornecedor: CreateFornecedorDto): Promise<any> {
    await this.ensureAuthenticated();

    await this.sankhyaQueue.add("create-fornecedor", fornecedor);

    return { message: "Fornecedor adicionado à fila de processamento" };
  }

  async getEmpresas(filters?: any): Promise<EmpresaDto[]> {
    await this.ensureAuthenticated();

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/service.sbr`,
        {
          serviceName: "CRUDServiceProvider.loadRecords",
          requestBody: {
            dataSet: {
              rootEntity: "Empresa",
              includePresentationFields: "S",
              criteria: filters,
            },
          },
        },
        this.getHeaders()
      )
    );

    return response.data.responseBody.entities.map(this.mapToEmpresaDto);
  }

  async getProdutos(filters?: any): Promise<ProdutoDto[]> {
    await this.ensureAuthenticated();

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/service.sbr`,
        {
          serviceName: "CRUDServiceProvider.loadRecords",
          requestBody: {
            dataSet: {
              rootEntity: "Produto",
              includePresentationFields: "S",
              criteria: filters,
            },
          },
        },
        this.getHeaders()
      )
    );

    return response.data.responseBody.entities.map(this.mapToProdutoDto);
  }

  async getPedidos(filters?: any): Promise<PedidoDto[]> {
    await this.ensureAuthenticated();

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/service.sbr`,
        {
          serviceName: "CRUDServiceProvider.loadRecords",
          requestBody: {
            dataSet: {
              rootEntity: "CabecalhoNota",
              includePresentationFields: "S",
              criteria: {
                expression: {
                  $: "TIPMOV IN ('V', 'S')",
                  ...filters,
                },
              },
            },
          },
        },
        this.getHeaders()
      )
    );

    return response.data.responseBody.entities.map(this.mapToPedidoDto);
  }

  async createPedido(pedido: CreatePedidoDto): Promise<any> {
    await this.ensureAuthenticated();

    await this.sankhyaQueue.add("create-pedido", pedido);

    return { message: "Pedido adicionado à fila de processamento" };
  }

  async getVendedores(filters?: any): Promise<VendedorDto[]> {
    await this.ensureAuthenticated();

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/service.sbr`,
        {
          serviceName: "CRUDServiceProvider.loadRecords",
          requestBody: {
            dataSet: {
              rootEntity: "Vendedor",
              includePresentationFields: "S",
              criteria: filters,
            },
          },
        },
        this.getHeaders()
      )
    );

    return response.data.responseBody.entities.map(this.mapToVendedorDto);
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.sessionId) {
      await this.authenticate();
    }
  }

  private getHeaders() {
    return {
      headers: {
        Cookie: `JSESSIONID=${this.sessionId}`,
        Authorization: `Bearer ${this.token}`,
        token: this.apiKey,
        "Content-Type": "application/json",
      },
    };
  }

  private mapToFornecedorDto(entity: any): FornecedorDto {
    return {
      id: entity.CODPARC,
      nome: entity.NOMEPARC,
      email: entity.EMAIL,
      telefone: entity.TELEFONE,
      cpfCnpj: entity.CGC_CPF,
      tipo: entity.TIPPESSOA,
      ativo: entity.ATIVO === "S",
    };
  }

  private mapToEmpresaDto(entity: any): EmpresaDto {
    return {
      id: entity.CODEMP,
      nome: entity.NOMEFANTASIA,
      razaoSocial: entity.RAZAOSOCIAL,
      cnpj: entity.CGC,
    };
  }

  private mapToProdutoDto(entity: any): ProdutoDto {
    return {
      id: entity.CODPROD,
      nome: entity.DESCRPROD,
      codigo: entity.REFERENCIA,
      preco: entity.VLRVENDA,
      estoque: entity.ESTOQUE,
      ativo: entity.ATIVO === "S",
    };
  }

  private mapToPedidoDto(entity: any): PedidoDto {
    return {
      id: entity.NUNOTA,
      clienteId: entity.CODPARC,
      empresaId: entity.CODEMP,
      vendedorId: entity.CODVEND,
      data: entity.DTNEG,
      valorTotal: entity.VLRNOTA,
      status: entity.STATUSNOTA,
      tipoMovimento: entity.TIPMOV,
      numeroNota: entity.NUMNOTA,
    };
  }

  private mapToVendedorDto(entity: any): VendedorDto {
    return {
      id: entity.CODVEND,
      nome: entity.NOMEVEND,
      email: entity.EMAIL,
      ativo: entity.ATIVO === "S",
    };
  }
}
