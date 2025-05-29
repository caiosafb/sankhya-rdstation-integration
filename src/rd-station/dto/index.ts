export interface ContactDto {
  uuid?: string;
  email: string;
  name?: string;
  phone?: string;
  mobile_phone?: string;
  city?: string;
  state?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

export interface CreateContactDto {
  email: string;
  name?: string;
  phone?: string;
  mobile_phone?: string;
  city?: string;
  state?: string;
  tags?: string[];
  custom_fields?: {
    cf_sankhya_id?: string;
    cf_cpf_cnpj?: string;
    cf_tipo?: string;
    cf_empresa?: string;
    [key: string]: any;
  };
}

export interface UpdateContactDto {
  name?: string;
  phone?: string;
  mobile_phone?: string;
  city?: string;
  state?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

export interface ConversionDto {
  email: string;
  conversion_identifier: string;
  name?: string;
  company_name?: string;
  job_title?: string;
  phone?: string;
  mobile_phone?: string;
  cf_order_id?: string;
  cf_order_total_value?: number;
  cf_sankhya_id?: string;
  cf_produto?: string;
  [key: string]: any;
}

export interface CreateEventDto {
  event_type: string;
  event_family: string;
  payload: any;
}

export interface WebhookDto {
  event_type: string;
  event_uuid: string;
  event_timestamp: string;
  entity_type: string;
  payload: any;
}
