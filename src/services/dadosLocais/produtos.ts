/** Produtos nos dados locais: cadastrar, listar, editar e repor estoque. */
import type {
  ProdutoCriarRequest,
  ProdutoCriarResponse,
  ProdutoEditarRequest,
  ProdutoListarResponse,
} from '../../types';
import { CHAVE_PRODUTOS, ler, proximoId, salvar, substituir } from './armazenamento';

export async function cadastrarProdutoLocal(dados: ProdutoCriarRequest): Promise<ProdutoCriarResponse> {
  const produtos = ler<ProdutoCriarResponse>(CHAVE_PRODUTOS);
  // O cadastro não recebe status (igual ao back): todo produto novo entra como disponível.
  const novo: ProdutoCriarResponse = { ...dados, id: proximoId(produtos), nome: dados.nome.trim(), status: 'DISPONIVEL' };
  salvar(CHAVE_PRODUTOS, [...produtos, novo]);
  return novo;
}

export async function listarProdutosLocal(): Promise<ProdutoListarResponse[]> {
  return ler<ProdutoListarResponse>(CHAVE_PRODUTOS);
}

/**
 * Edita nome, descrição, preços e status (inclusive desativar/reativar). O estoque só muda por
 * "Repor estoque" e pelos pedidos.
 */
export async function editarProdutoLocal(id: number, dados: ProdutoEditarRequest): Promise<ProdutoCriarResponse> {
  const produtos = ler<ProdutoCriarResponse>(CHAVE_PRODUTOS);
  const atual = produtos.find((p) => p.id === id);
  if (!atual) throw new Error('Produto não encontrado.');
  const nome = dados.nome.trim();
  if (!nome) throw new Error('Informe o nome do produto.');
  const precoVenda = Number(dados.precoVenda);
  const precoAluguel = Number(dados.precoAluguel);
  if (!Number.isFinite(precoVenda) || precoVenda < 0) throw new Error('Preço de venda inválido.');
  if (!Number.isFinite(precoAluguel) || precoAluguel < 0) throw new Error('Preço de aluguel inválido.');
  return substituir(CHAVE_PRODUTOS, produtos, {
    ...atual,
    nome,
    descricao: dados.descricao.trim(),
    precoVenda,
    precoAluguel,
    status: dados.status,
  });
}

/** Repor estoque: soma a quantidade ao estoque atual (não substitui e não muda o status). */
export async function reporEstoqueLocal(id: number, quantidade: number): Promise<ProdutoCriarResponse> {
  const produtos = ler<ProdutoCriarResponse>(CHAVE_PRODUTOS);
  const atual = produtos.find((p) => p.id === id);
  if (!atual) throw new Error('Produto não encontrado.');
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error('Informe uma quantidade inteira maior que zero para repor.');
  }
  return substituir(CHAVE_PRODUTOS, produtos, { ...atual, estoque: atual.estoque + quantidade });
}
