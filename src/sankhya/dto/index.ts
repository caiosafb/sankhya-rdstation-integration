export interface FornecedorDto {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  cpfCnpj: string;
  tipo: string;
  ativo: boolean;
}

export interface CreateFornecedorDto {
  nome: string;
  email: string;
  telefone?: string;
  cpfCnpj: string;
  tipo: string;
}

export interface EmpresaDto {
  id: number;
  nome: string;
  razaoSocial: string;
  cnpj: string;
}

export interface ProdutoDto {
  id: number;
  nome: string;
  codigo: string;
  preco: number;
  estoque: number;
  ativo: boolean;
}

export interface PedidoDto {
  id: number;
  clienteId: number;
  empresaId: number;
  vendedorId: number;
  data: Date;
  valorTotal: number;
  status: string;
  tipoMovimento: string;
  numeroNota: string;
}

export interface CreatePedidoDto {
  clienteId: number;
  empresaId: number;
  vendedorId: number;
  produtos: ProdutoPedidoDto[];
}

export interface ProdutoPedidoDto {
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
}

export interface VendedorDto {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
}
