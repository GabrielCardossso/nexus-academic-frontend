/**
 * Onde os dados locais ficam guardados (localStorage), no formato das tabelas do back, e os
 * ajudantes usados por todos os arquivos desta pasta.
 * Para limpar os dados: F12 > Application > Local Storage > apagar "nexus:*".
 */
import { CARREGAR_MOCKS } from '../../config/api';
import type {
  ClienteSalvo,
  ModalidadePagamento,
  ProdutoStatus,
  StatusAprovacaoDesconto,
  StatusPedido,
} from '../../types';
import { gerarMocks } from './mocks';

// "v10": modelo do back (aluguel por item, um status de pedido, desconto em fração, soft delete) e o
// pedido a prazo com desconto pendente reservando no limite o valor com o desconto pedido (valorReservado).
// Dados de versões antigas ficam de lado e os de exemplo são recriados.
export const CHAVE_CLIENTES = 'nexus:v10:clientes';
export const CHAVE_PRODUTOS = 'nexus:v10:produtos';
export const CHAVE_PEDIDOS = 'nexus:v10:pedidos';
export const CHAVE_COLABORADORES = 'nexus:v10:colaboradores';

/** Tabela produto (entity/Produto.java). O cadastro do back grava DISPONIVEL; null só em produto antigo. */
export interface ProdutoSalvo {
  id: number;
  nome: string;
  descricao: string;
  estoque: number;
  precoVenda: number;
  precoAluguel: number;
  status: ProdutoStatus | null;
  excluido?: boolean; // @SoftDelete
}

/** Tabela colaborador (entity/Colaborador.java). */
export interface ColaboradorSalvo {
  id: number;
  nome: string;
  cpf: string;
  email: string;
  excluido?: boolean; // @SoftDelete
}

/** Tabela item_pedido (entity/ItemPedido.java). */
export interface ItemSalvo {
  produtoId: number;
  quantidade: number;
  valorItem: number;
  isAluguel: boolean;
  dataVencimentoAluguel: string | null;
  dataDevolucao: string | null;
}

/** Tabela pedido (entity/Pedido.java). */
export interface PedidoSalvo {
  id: number;
  descricao: string | null;
  valorTotal: number;
  dataCriacao: string;
  dataVencimento: string | null;
  dataAtualizacaoDesconto: string | null;
  descontoAutorizado: number;
  descontoSolicitado: number;
  statusPedido: StatusPedido;
  statusAprovacaoDesconto: StatusAprovacaoDesconto;
  modalidadePagamento: ModalidadePagamento;
  clienteId: number;
  colaboradorDescontoId: number | null;
  itens: ItemSalvo[];
  excluido?: boolean; // @SoftDelete (DELETE /pedidos/{id})
}

/** Primeira execução (nada salvo ainda): grava os dados de exemplo de mocks.ts. */
function carregarMocksSeVazio() {
  try {
    const chaves = [CHAVE_CLIENTES, CHAVE_PRODUTOS, CHAVE_PEDIDOS, CHAVE_COLABORADORES];
    if (!CARREGAR_MOCKS || chaves.some((c) => localStorage.getItem(c) !== null)) return;
    const { clientes, produtos, colaboradores, pedidos } = gerarMocks();
    salvar(CHAVE_CLIENTES, clientes);
    salvar(CHAVE_PRODUTOS, produtos);
    salvar(CHAVE_COLABORADORES, colaboradores);
    salvar(CHAVE_PEDIDOS, pedidos);
  } catch {
    // localStorage indisponível: segue sem mocks
  }
}

export function ler<T>(chave: string): T[] {
  carregarMocksSeVazio();
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T[]) : [];
  } catch {
    return [];
  }
}

export function salvar<T>(chave: string, itens: T[]) {
  localStorage.setItem(chave, JSON.stringify(itens));
}

/** Registros não excluídos (o filtro que o @SoftDelete faz em todas as consultas do back). */
export const ativos = <T extends { excluido?: boolean }>(lista: T[]) => lista.filter((x) => !x.excluido);

/** Simula o @GeneratedValue(IDENTITY): maior id já usado (inclusive excluídos) + 1. */
export function proximoId(itens: { id: number }[]): number {
  return itens.reduce((maior, item) => Math.max(maior, item.id), 0) + 1;
}

/** Troca um registro (pelo id) e salva a lista. */
export function substituir<T extends { id: number }>(chave: string, lista: T[], atualizado: T): T {
  salvar(chave, lista.map((x) => (x.id === atualizado.id ? atualizado : x)));
  return atualizado;
}

/** Erro no formato do back: a tela mostra o "detail" do ProblemDetail. */
export function falha(detail: string): never {
  throw new Error(detail);
}

export type { ClienteSalvo };
