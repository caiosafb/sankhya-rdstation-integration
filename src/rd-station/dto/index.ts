export interface ContactDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  organizationId?: string;
  customFields?: any;
}

export interface CreateContactDto {
  name: string;
  emails: Array<{ email: string }>;
  phones?: Array<{ phone: string }>;
  organization_id?: string;
  custom_fields?: {
    cf_sankhya_id?: string;
    cf_cpf_cnpj?: string;
    [key: string]: any;
  };
}

export interface UpdateContactDto {
  name?: string;
  emails?: Array<{ email: string }>;
  phones?: Array<{ phone: string }>;
  custom_fields?: any;
}

export interface OrganizationDto {
  id: string;
  name: string;
  legalName: string;
  cnpj: string;
}

export interface CreateOrganizationDto {
  nome: string;
  razaoSocial: string;
  cnpj: string;
  sankhyaId?: string;
}

export interface DealDto {
  id: string;
  name: string;
  organizationId?: string;
  contactIds: string[];
  value: number;
  stage: string;
  customFields?: any;
}

export interface ProductDto {
  id: string;
  name: string;
  code: string;
  price: number;
}

export interface CreateProductDto {
  nome: string;
  codigo: string;
  preco: number;
  sankhyaId?: string;
}

export interface UpdateProductDto {
  nome?: string;
  codigo?: string;
  preco?: number;
}
