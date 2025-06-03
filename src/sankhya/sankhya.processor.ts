import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { CreateFornecedorDto, CreatePedidoDto } from "./dto";

@Processor("sankhya-queue")
export class SankhyaProcessor {
  private readonly logger = new Logger(SankhyaProcessor.name);
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

  @Process("create-fornecedor")
  async handleCreateFornecedor(job: Job<CreateFornecedorDto>) {
    this.logger.log(`Processing fornecedor creation: ${job.data.email}`);

    try {
      await this.ensureAuthenticated();

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
                    NOMEPARC: job.data.nome,
                    EMAIL: job.data.email,
                    TELEFONE: job.data.telefone || "",
                    CGC_CPF: job.data.cpfCnpj,
                    TIPPESSOA: job.data.tipo,
                    FORNECEDOR: "S",
                    CLIENTE: "N",
                    ATIVO: "S",
                  },
                },
              },
            },
          },
          this.getHeaders()
        )
      );

      this.logger.log(`Fornecedor created successfully: ${response.data}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to create fornecedor: ${job.data.email}`,
        error.response?.data || error
      );
      throw error;
    }
  }

  @Process("create-pedido")
  async handleCreatePedido(job: Job<CreatePedidoDto>) {
    this.logger.log(
      `Processing pedido creation for client: ${job.data.clienteId}`
    );

    try {
      await this.ensureAuthenticated();

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
                    CODPARC: job.data.clienteId,
                    CODEMP: job.data.empresaId,
                    CODVEND: job.data.vendedorId,
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
        throw new Error("Failed to get NUNOTA from response");
      }

      for (const item of job.data.produtos) {
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

      this.logger.log(`Pedido created successfully: ${nunota}`);
      return { nunota };
    } catch (error) {
      this.logger.error(
        `Failed to create pedido for client: ${job.data.clienteId}`,
        error.response?.data || error
      );
      throw error;
    }
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
}
