import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import {
  SupplierDto,
  CompanyDto,
  ProductDto,
  OrderDto,
  SellerDto,
  CreateSupplierDto,
  CreateOrderDto,
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

  async getSuppliers(filters?: any): Promise<SupplierDto[]> {
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

    return response.data.responseBody.entities.map(this.mapToSupplierDto);
  }

  async createSupplier(supplier: CreateSupplierDto): Promise<number> {
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
                    NOMEPARC: supplier.name,
                    EMAIL: supplier.email,
                    TELEFONE: supplier.phone || "",
                    CGC_CPF: supplier.taxId,
                    TIPPESSOA: supplier.type,
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

      const partnerId = response.data.responseBody.primaryKey?.CODPARC;
      this.logger.log(`Supplier created successfully. ID: ${partnerId}`);

      return partnerId;
    } catch (error) {
      this.logger.error(
        `Failed to create supplier: ${supplier.email}`,
        error.response?.data || error
      );
      throw error;
    }
  }

  async getCompanies(filters?: any): Promise<CompanyDto[]> {
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

    return response.data.responseBody.entities.map(this.mapToCompanyDto);
  }

  async getProducts(filters?: any): Promise<ProductDto[]> {
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

    return response.data.responseBody.entities.map(this.mapToProductDto);
  }

  async getOrders(filters?: any): Promise<OrderDto[]> {
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

    return response.data.responseBody.entities.map(this.mapToOrderDto);
  }

  async createOrder(order: CreateOrderDto): Promise<number> {
    await this.ensureAuthenticated();

    try {
      const headerResponse = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/service.sbr`,
          {
            serviceName: "CRUDServiceProvider.saveRecord",
            requestBody: {
              dataSet: {
                rootEntity: "CabecalhoNota",
                dataRow: {
                  localFields: {
                    CODPARC: order.customerId,
                    CODEMP: order.companyId,
                    CODVEND: order.sellerId,
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

      const invoiceId = headerResponse.data.responseBody.primaryKey?.NUNOTA;

      if (!invoiceId) {
        throw new Error("Failed to get NUNOTA from response");
      }

      for (const item of order.items) {
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
                      NUNOTA: invoiceId,
                      CODPROD: item.productId,
                      QTDNEG: item.quantity,
                      VLRUNIT: item.unitPrice,
                      VLRTOT: item.quantity * item.unitPrice,
                    },
                  },
                },
              },
            },
            this.getHeaders()
          )
        );
      }

      this.logger.log(`Order created successfully. NUNOTA: ${invoiceId}`);
      return invoiceId;
    } catch (error) {
      this.logger.error(
        `Failed to create order for customer: ${order.customerId}`,
        error.response?.data || error
      );
      throw error;
    }
  }

  async getSellers(filters?: any): Promise<SellerDto[]> {
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

    return response.data.responseBody.entities.map(this.mapToSellerDto);
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

  private mapToSupplierDto(entity: any): SupplierDto {
    return {
      id: entity.CODPARC,
      name: entity.NOMEPARC,
      email: entity.EMAIL,
      phone: entity.TELEFONE,
      taxId: entity.CGC_CPF,
      type: entity.TIPPESSOA,
      active: entity.ATIVO === "S",
    };
  }

  private mapToCompanyDto(entity: any): CompanyDto {
    return {
      id: entity.CODEMP,
      name: entity.NOMEFANTASIA,
      legalName: entity.RAZAOSOCIAL,
      taxId: entity.CGC,
    };
  }

  private mapToProductDto(entity: any): ProductDto {
    return {
      id: entity.CODPROD,
      name: entity.DESCRPROD,
      code: entity.REFERENCIA,
      price: entity.VLRVENDA,
      stock: entity.ESTOQUE,
      active: entity.ATIVO === "S",
    };
  }

  private mapToOrderDto(entity: any): OrderDto {
    return {
      id: entity.NUNOTA,
      customerId: entity.CODPARC,
      companyId: entity.CODEMP,
      sellerId: entity.CODVEND,
      date: entity.DTNEG,
      totalValue: entity.VLRNOTA,
      status: entity.STATUSNOTA,
      movementType: entity.TIPMOV,
      invoiceNumber: entity.NUMNOTA,
    };
  }

  private mapToSellerDto(entity: any): SellerDto {
    return {
      id: entity.CODVEND,
      name: entity.NOMEVEND,
      email: entity.EMAIL,
      active: entity.ATIVO === "S",
    };
  }
}
