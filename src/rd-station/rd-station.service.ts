import { Injectable, Logger, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { firstValueFrom } from 'rxjs';
import {
  ContactDto,
  OrganizationDto,
  DealDto,
  ProductDto,
  CreateContactDto,
  CreateOrganizationDto,
  UpdateContactDto,
  CreateProductDto,
  UpdateProductDto,
} from './dto';

@Injectable()
export class RdStationService {
  private readonly logger = new Logger(RdStationService.name);
  private readonly baseUrl = 'https://api.rd.services/platform/crm';
  private readonly token: string;
  private requestCount = 0;
  private lastReset = Date.now();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectQueue('rd-station-queue') private rdQueue: Queue,
  ) {
    this.token = this.configService.get<string>('RD_STATION_TOKEN');
  }

  private async checkRateLimit() {
    const now = Date.now();
    if (now - this.lastReset > 60000) {
      this.requestCount = 0;
      this.lastReset = now;
    }
    
    if (this.requestCount >= 120) {
      throw new HttpException('Rate limit exceeded', 429);
    }
    
    this.requestCount++;
  }

  private getHeaders() {
    return {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async createProduct(product: CreateProductDto): Promise<any> {
    await this.checkRateLimit();
    
    const payload = {
      name: product.nome,
      custom_fields: {
        cf_codigo_produto: product.codigo,
        cf_preco: product.preco,
        cf_sankhya_id: product.sankhyaId,
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/products`,
          payload,
          this.getHeaders(),
        ),
      );
      
      this.logger.log(`Product created: ${product.nome}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create product', error);
      throw error;
    }
  }

  async updateProduct(id: string, product: UpdateProductDto): Promise<any> {
    await this.checkRateLimit();
    
    const payload = {
      name: product.nome,
      custom_fields: {
        cf_codigo_produto: product.codigo,
        cf_preco: product.preco,
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.put(
          `${this.baseUrl}/products/${id}`,
          payload,
          this.getHeaders(),
        ),
      );
      
      this.logger.log(`Product updated: ${id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update product: ${id}`, error);
      throw error;
    }
  }

  async createOrganization(org: CreateOrganizationDto): Promise<any> {
    await this.checkRateLimit();
    
    const payload = {
      name: org.nome,
      legal_name: org.razaoSocial,
      cnpj: org.cnpj,
      custom_fields: {
        cf_sankhya_id: org.sankhyaId,
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/organizations`,
          payload,
          this.getHeaders(),
        ),
      );
      
      this.logger.log(`Organization created: ${org.nome}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create organization', error);
      throw error;
    }
  }

  async createContact(contact: CreateContactDto): Promise<any> {
    await this.checkRateLimit();
    
    await this.rdQueue.add('create-contact', contact);
    
    return { message: 'Contact added to processing queue' };
  }

  async getContact(email: string): Promise<ContactDto> {
    await this.checkRateLimit();
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/contacts?email=${email}`,
          this.getHeaders(),
        ),
      );
      
      if (response.data.contacts.length === 0) {
        return null;
      }
      
      return this.mapToContactDto(response.data.contacts[0]);
    } catch (error) {
      this.logger.error(`Failed to get contact: ${email}`, error);
      throw error;
    }
  }

  async updateContact(id: string, contact: UpdateContactDto): Promise<any> {
    await this.checkRateLimit();
    
    const payload = {
      name: contact.name,
      phones: contact.phones,
      emails: contact.emails,
      custom_fields: contact.custom_fields,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.put(
          `${this.baseUrl}/contacts/${id}`,
          payload,
          this.getHeaders(),
        ),
      );
      
      this.logger.log(`Contact updated: ${id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update contact: ${id}`, error);
      throw error;
    }
  }

  async listDeals(page: number = 1, limit: number = 200): Promise<DealDto[]> {
    await this.checkRateLimit();
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/deals?page=${page}&limit=${limit}`,
          this.getHeaders(),
        ),
      );
      
      return response.data.deals.map(this.mapToDealDto);
    } catch (error) {
      this.logger.error('Failed to list deals', error);
      throw error;
    }
  }

  private mapToContactDto(data: any): ContactDto {
    return {
      id: data.id,
      name: data.name,
      email: data.emails?.[0]?.email,
      phone: data.phones?.[0]?.phone,
      organizationId: data.organization_id,
      customFields: data.custom_fields,
    };
  }

  private mapToDealDto(data: any): DealDto {
    return {
      id: data.id,
      name: data.name,
      organizationId: data.organization_id,
      contactIds: data.contact_ids,
      value: data.deal_custom_fields?.find(f => f.custom_field_id === 'cf_deal_value')?.value,
      stage: data.deal_stage_id,
      customFields: data.deal_custom_fields,
    };
  }
}
