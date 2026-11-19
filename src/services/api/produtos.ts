/** Produtos: back real (/produtos) ou dados locais, conforme USAR_DADOS_LOCAIS. */
import { ENDPOINTS, USAR_DADOS_LOCAIS } from '../../config/api';
import type {
  ItemAlugado,
  ProdutoCriarRequest,
  ProdutoCriarResponse,
  ProdutoEditarRequest,
  ProdutoListarResponse,
  ProdutoStatus,
} from '../../types';
import {
  cadastrarProdutoLocal,
  editarProdutoLocal,
  excluirProdutoLocal,
  listarAlugadosLocal,
  listarProdutosLocal,
  reporEstoqueLocal,
} from '../dadosLocais';
import { del, getLista, post, put } from './http';

// DTOs do back (records Java) — nomes exatamente como lá
/** dtos/ProdutoCriarRequest.java */
interface ProdutoBackRequest {
  nome: string;
  descricao: string;
  estoque: number;
  precoVenda: number;
  precoAluguel: number;
}
/** dtos/ProdutoListarResponse.java */
interface ProdutoBackListar extends ProdutoBackRequest {
  id: number;
  statusProduto: ProdutoStatus | null;
}
/** dtos/ProdutoAdicionarEstoqueRequest.java */
interface ProdutoBackAdicionarEstoque {
  idProduto: number;
  qtdAdicionar: number;
}

/** POST /produtos (sem status: o back não recebe e grava DISPONIVEL). */
export async function cadastrarProduto(produto: ProdutoCriarRequest): Promise<ProdutoCriarResponse> {
  if (USAR_DADOS_LOCAIS) return cadastrarProdutoLocal(produto);
  const corpo: ProdutoBackRequest = { ...produto, nome: produto.nome.trim(), descricao: produto.descricao.trim() };
  return post<ProdutoCriarResponse>(ENDPOINTS.produtos, corpo);
}

/** GET /produtos (só os não excluídos). */
export async function listarProdutos(): Promise<ProdutoListarResponse[]> {
  if (USAR_DADOS_LOCAIS) return listarProdutosLocal();
  const lista = await getLista<ProdutoBackListar>(ENDPOINTS.produtos);
  return lista.map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao ?? '',
    estoque: Number(p.estoque ?? 0),
    precoVenda: Number(p.precoVenda ?? 0),
    precoAluguel: Number(p.precoAluguel ?? 0),
    status: p.statusProduto ?? null,
  }));
}

/** GET /produtos/listarAlugados: todos os itens de aluguel (devolvidos ou não). */
export async function listarProdutosAlugados(): Promise<ItemAlugado[]> {
  if (USAR_DADOS_LOCAIS) return listarAlugadosLocal();
  const lista = await getLista<ItemAlugado>(ENDPOINTS.produtosAlugados);
  return lista.map((i) => ({ ...i, quantidade: Number(i.quantidade) }));
}

/** PUT /produtos/{id}/editar (nome, descrição e preços). */
export async function editarProduto(id: number, produto: ProdutoEditarRequest): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await editarProdutoLocal(id, produto);
    return;
  }
  await put(ENDPOINTS.produtoEditar(id), { ...produto, nome: produto.nome.trim() });
}

/** PUT /produtos/adicionarEstoque: soma ao estoque. Devolve o estoque novo. */
export async function reporEstoque(id: number, quantidade: number): Promise<number> {
  if (USAR_DADOS_LOCAIS) return (await reporEstoqueLocal(id, quantidade)).estoque;
  const corpo: ProdutoBackAdicionarEstoque = { idProduto: id, qtdAdicionar: quantidade };
  const r = await put<{ estoque: number }>(ENDPOINTS.produtoAdicionarEstoque, corpo);
  return Number(r.estoque);
}

/** DELETE /produtos/{id} (soft delete: some da listagem; o back não tem reativar produto). */
export async function excluirProduto(id: number): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await excluirProdutoLocal(id);
    return;
  }
  await del(ENDPOINTS.produto(id));
}
