/** Clientes: back real (/clientes) ou dados locais, conforme USAR_DADOS_LOCAIS. */
import { ENDPOINTS, USAR_DADOS_LOCAIS } from '../../config/api';
import { estaInadimplente } from '../../regras';
import type {
  ClienteCategoria,
  ClienteCriarRequest,
  ClienteCriarResponse,
  ClienteEditarRequest,
  ClienteListarResponse,
} from '../../types';
import {
  cadastrarClienteLocal,
  editarClienteLocal,
  excluirClienteLocal,
  listarClientesLocal,
  reativarClienteLocal,
} from '../dadosLocais';
import { del, getLista, post, put } from './http';
import { listarPedidosVencidos } from './pedidos';

// DTOs do back (records Java) — nomes exatamente como lá
/** dtos/ClienteCriarRequest.java e ClienteEditarRequest.java */
interface ClienteBackRequest {
  name: string;
  telefone: string;
  cnpj?: string; // na edição, sem CNPJ = mantém o atual
  email: string;
  limiteDeCredito?: number; // na edição, sem limite = mantém o atual
  classificacao: ClienteCategoria;
}
/** dtos/ClienteCriarResponse.java */
interface ClienteBackCriarResponse {
  id: number;
  name: string;
  email: string;
  classificacao: ClienteCategoria;
}
/** dtos/ClienteListarResponse.java */
interface ClienteBackListar {
  id: number;
  cnpj: string;
  name: string;
  telefone: string;
  email: string;
  limiteDeCredito: number;
  classificacao: ClienteCategoria;
}

const paraBack = (c: ClienteEditarRequest): ClienteBackRequest => ({
  name: c.name.trim(),
  telefone: c.telefone.trim(),
  cnpj: c.cnpj.replace(/[^0-9a-z]/gi, '').toUpperCase() || undefined,
  email: c.email.trim(),
  limiteDeCredito: c.limiteCredito === undefined ? undefined : Number(c.limiteCredito),
  classificacao: c.categoria,
});

/** POST /clientes */
export async function cadastrarCliente(cliente: ClienteCriarRequest): Promise<ClienteCriarResponse> {
  if (USAR_DADOS_LOCAIS) return cadastrarClienteLocal(cliente);
  const r = await post<ClienteBackCriarResponse>(ENDPOINTS.clientes, paraBack(cliente));
  return { id: r.id, name: r.name, email: r.email, categoria: r.classificacao, limiteCredito: Number(cliente.limiteCredito) };
}

/** GET /clientes. A situação (inadimplente) vem de GET /pedidos/vencidosEmAberto. */
export async function listarClientes(): Promise<ClienteListarResponse[]> {
  if (USAR_DADOS_LOCAIS) return listarClientesLocal();
  const [lista, vencidos] = await Promise.all([getLista<ClienteBackListar>(ENDPOINTS.clientes), listarPedidosVencidos()]);
  return lista.map((c) => ({
    id: c.id,
    cnpj: c.cnpj,
    name: c.name,
    telefone: c.telefone,
    email: c.email,
    categoria: c.classificacao,
    limiteCredito: Number(c.limiteDeCredito ?? 0),
    inadimplente: estaInadimplente({ id: c.id, email: c.email }, vencidos),
  }));
}

/** PUT /clientes/{id}/editar */
export async function editarCliente(id: number, cliente: ClienteEditarRequest): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await editarClienteLocal(id, cliente);
    return;
  }
  await put(ENDPOINTS.clienteEditar(id), paraBack(cliente));
}

/** DELETE /clientes/{id} (soft delete: some da listagem). Bloqueado se o cliente tiver pedido pendente. */
export async function excluirCliente(id: number): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await excluirClienteLocal(id);
    return;
  }
  await del(ENDPOINTS.cliente(id));
}

/** PUT /clientes/{id}/reativar */
export async function reativarCliente(id: number): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await reativarClienteLocal(id);
    return;
  }
  await put(ENDPOINTS.clienteReativar(id));
}
