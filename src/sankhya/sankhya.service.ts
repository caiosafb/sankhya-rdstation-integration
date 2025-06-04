import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
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
    private readonly configService: ConfigService
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

  async createFornecedor(fornecedor: CreateFornecedorDto): Promise<number> {
    await this.ensureAuthenticated();

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/service.sbr`,
          {
            serviceName: "CRUDServiceProvider.saveRecord",
            requestBody: {
              dataSet: {
                rootEntity: "Parceiro",
                dataRow: {
                  localFields: {
                    NOMEPARC: fornecedor.nome,
                    EMAIL: fornecedor.email,
                    TELEFONE: fornecedor.telefone || "",
                    CGC_CPF: fornecedor.cpfCnpj,
                    TIPPESSOA: fornecedor.tipo,
                    FORNECEDOR: "S",
                    CLIENTE: "S",
                    ATIVO: "S",
                  },
                },
              },
            },
          },
          this.getHeaders()
        )
      );

      const codParc = response.data.responseBody.primaryKey?.CODPARC;
      this.logger.log(`Fornecedor criado com sucesso. ID: ${codParc}`);

      return codParc;
    } catch (error) {
      this.logger.error(
        `Falha ao criar fornecedor: ${fornecedor.email}`,
        error.response?.data || error
      );
      throw error;
    }
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

  async createPedido(pedido: CreatePedidoDto): Promise<number> {
    await this.ensureAuthenticated();

    try {
      const cabecalhoResponse = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/service.sbr`,
          {
            serviceName: "CRUDServiceProvider.saveRecord",
            requestBody: {
              dataSet: {
                rootEntity: "CabecalhoNota",
                dataRow: {
                  localFields: {
                    CODPARC: pedido.clienteId,
                    CODEMP: pedido.empresaId,
                    CODVEND: pedido.vendedorId,
                    DTNEG: new Date().toISOString(),
                    TIPMOV: "V", 
                    STATUSNOTA: "L", 
                  },
                },
              },
            },
          },
          this.getHeaders()
        )
      );

      const nunota = cabecalhoResponse.data.responseBody.primaryKey?.NUNOTA;

      if (!nunota) {
        throw new Error("Falha ao obter NUNOTA da resposta");
      }

      for (const item of pedido.produtos) {
        await firstValueFrom(
          this.httpService.post(
            `${this.baseUrl}/service.sbr`,
            {
              serviceName: "CRUDServiceProvider.saveRecord",
              requestBody: {
                dataSet: {
                  rootEntity: "ItemNota",
                  dataRow: {
                    localFields: {
                      NUNOTA: nunota,
                      CODPROD: item.produtoId,
                      QTDNEG: item.quantidade,
                      VLRUNIT: item.precoUnitario,
                      VLRTOT: item.quantidade * item.precoUnitario,
                    },
                  },
                },
              },
            },
            this.getHeaders()
          )
        );
      }

      this.logger.log(`Pedido criado com sucesso. NUNOTA: ${nunota}`);
      return nunota;
    } catch (error) {
      this.logger.error(
        `Falha ao criar pedido para cliente: ${pedido.clienteId}`,
        error.response?.data || error
      );
      throw error;
    }
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
