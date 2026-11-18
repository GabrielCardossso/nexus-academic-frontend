/** Produtos: back real (POST/GET /produtos) ou dados locais, conforme USAR_DADOS_LOCAIS. */
import { ENDPOINTS, USAR_DADOS_LOCAIS } from '../../config/api';
import type {
  ProdutoCriarRequest,
  ProdutoCriarResponse,
  ProdutoEditarRequest,
  ProdutoListarResponse,
  ProdutoStatus,
} from '../../types';
import { cadastrarProdutoLocal, editarProdutoLocal, listarProdutosLocal, reporEstoqueLocal } from '../dadosLocais';
import { exigirLocal, get, idProvisorio, post } from './http';

// DTOs do back (records Java) — nomes exatamente como lá
interface ProdutoBackRequest {
  nome: string;
  descricao: string;
  estoque: number;
  precoVenda: number;
  precoAluguel: number;
}
type ProdutoBackCriarResponse = ProdutoBackRequest & { id: number };
/** A listagem do back hoje devolve só nome, descricao, estoque e "preco"; id, preços e status ainda faltam. */
interface ProdutoBackListar {
  id?: number;
  nome: string;
  descricao: string;
  estoque: number;
  preco?: number;
  precoVenda?: number;
  precoAluguel?: number;
  statusProduto?: ProdutoStatus;
}

export async function cadastrarProduto(produto: ProdutoCriarRequest): Promise<ProdutoCriarResponse | null> {
  if (USAR_DADOS_LOCAIS) return cadastrarProdutoLocal(produto);
  const corpo: ProdutoBackRequest = { ...produto };
  const r = await post<ProdutoBackCriarResponse>(ENDPOINTS.produtos, corpo);
  return r && { ...r, status: 'DISPONIVEL' };
}

export async function listarProdutos(): Promise<ProdutoListarResponse[]> {
  if (USAR_DADOS_LOCAIS) return listarProdutosLocal();
  const lista = await get<ProdutoBackListar>(ENDPOINTS.produtos);
  return lista.map((p, i) => ({
    id: idProvisorio(p.id, i),
    nome: p.nome,
    descricao: p.descricao ?? '',
    estoque: Number(p.estoque ?? 0),
    precoVenda: Number(p.precoVenda ?? p.preco ?? 0),
    precoAluguel: Number(p.precoAluguel ?? 0),
    status: p.statusProduto ?? 'DISPONIVEL',
  }));
}

export async function editarProduto(id: number, produto: ProdutoEditarRequest) {
  exigirLocal('Editar produto');
  return editarProdutoLocal(id, produto);
}

export async function reporEstoque(id: number, quantidade: number) {
  exigirLocal('Repor estoque');
  return reporEstoqueLocal(id, quantidade);
}
