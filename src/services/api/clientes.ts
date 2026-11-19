/** Clientes: back real (/clientes) ou dados locais, conforme USAR_DADOS_LOCAIS. */
import { ENDPOINTS, USAR_DADOS_LOCAIS } from '../../config/api';
import { estaInadimplente } from '../../regras';
import type { ClienteCategoria, ClienteCriarRequest, ClienteCriarResponse, ClienteListarResponse } from '../../types';
import {
  cadastrarClienteLocal,
  editarClienteLocal,
  excluirClienteLocal,
  listarClientesLocal,
  reativarClienteLocal,
} from '../dadosLocais';
import { del, exigirId, getLista, idProvisorio, post, put } from './http';
import { listarPedidosVencidos } from './pedidos';

// DTOs do back (records Java) — nomes exatamente como lá
/** dtos/ClienteCriarRequest.java e ClienteEditarRequest.java */
interface ClienteBackRequest {
  name: string;
  telefone: string;
  cnpj?: string; // na edição, sem CNPJ = mantém o atual
  email: string;
  limiteDeCredito: number;
  classificacao: ClienteCategoria;
}
/** dtos/ClienteCriarResponse.java */
interface ClienteBackCriarResponse {
  id: number;
  name: string;
  email: string;
  classificacao: ClienteCategoria;
}
/** dtos/ClienteListarResponse.java (sem id e sem cnpj: ver README > pendências do back). */
interface ClienteBackListar {
  id?: number;
  cnpj?: string;
  name: string;
  telefone: string;
  email: string;
  limiteDeCredito: number;
  classificacao: ClienteCategoria;
}

const paraBack = (c: ClienteCriarRequest): ClienteBackRequest => ({
  name: c.name.trim(),
  telefone: c.telefone.trim(),
  cnpj: c.cnpj.replace(/[^0-9a-z]/gi, '').toUpperCase() || undefined,
  email: c.email.trim(),
  limiteDeCredito: Number(c.limiteCredito),
  classificacao: c.categoria,
});

/** POST /clientes */
export async function cadastrarCliente(cliente: ClienteCriarRequest): Promise<ClienteCriarResponse> {
  if (USAR_DADOS_LOCAIS) return cadastrarClienteLocal(cliente);
  const r = await post<ClienteBackCriarResponse>(ENDPOINTS.clientes, paraBack(cliente));
  return { id: r.id, name: r.name, email: r.email, categoria: r.classificacao, limiteCredito: Number(cliente.limiteCredito) };
}

/**
 * GET /clientes. Com o back real, a situação (inadimplente) vem de GET /pedidos/vencidosEmAberto,
 * comparando pelo e-mail (a listagem de clientes não traz o id).
 */
export async function listarClientes(): Promise<ClienteListarResponse[]> {
  if (USAR_DADOS_LOCAIS) return listarClientesLocal();
  const [lista, vencidos] = await Promise.all([getLista<ClienteBackListar>(ENDPOINTS.clientes), listarPedidosVencidos()]);
  return lista.map((c, i) => ({
    id: idProvisorio(c.id, i),
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
export async function editarCliente(id: number, cliente: ClienteCriarRequest): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await editarClienteLocal(id, cliente);
    return;
  }
  await put(ENDPOINTS.clienteEditar(exigirId(id, 'Editar cliente')), paraBack(cliente));
}

/** DELETE /clientes/{id} (soft delete: some da listagem). Bloqueado se o cliente tiver pedido pendente. */
export async function excluirCliente(id: number): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await excluirClienteLocal(id);
    return;
  }
  await del(ENDPOINTS.cliente(exigirId(id, 'Desativar cliente')));
}

/** PUT /clientes/{id}/reativar */
export async function reativarCliente(id: number): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await reativarClienteLocal(id);
    return;
  }
  await put(ENDPOINTS.clienteReativar(exigirId(id, 'Reativar cliente')));
}
