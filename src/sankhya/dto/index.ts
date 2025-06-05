export interface SupplierDto {
  id: number;
  name: string;
  email: string;
  phone: string;
  taxId: string;
  type: string;
  active: boolean;
}

export interface CreateSupplierDto {
  name: string;
  email: string;
  phone?: string;
  taxId: string;
  type: string;
}

export interface CompanyDto {
  id: number;
  name: string;
  legalName: string;
  taxId: string;
}

export interface ProductDto {
  id: number;
  name: string;
  code: string;
  price: number;
  stock: number;
  active: boolean;
}

export interface OrderDto {
  id: number;
  customerId: number;
  companyId: number;
  sellerId: number;
  date: Date;
  totalValue: number;
  status: string;
  movementType: string;
  invoiceNumber: string;
}

export interface CreateOrderDto {
  customerId: number;
  companyId: number;
  sellerId: number;
  items: OrderItemDto[];
}

export interface OrderItemDto {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface SellerDto {
  id: number;
  name: string;
  email: string;
  active: boolean;
}
