/** Clientes: back real (POST/GET /clientes) ou dados locais, conforme USAR_DADOS_LOCAIS. */
import { ENDPOINTS, USAR_DADOS_LOCAIS } from '../../config/api';
import type { ClienteCategoria, ClienteCriarRequest, ClienteCriarResponse, ClienteListarResponse } from '../../types';
import {
  cadastrarClienteLocal,
  definirClienteAtivoLocal,
  editarClienteLocal,
  listarClientesLocal,
} from '../dadosLocais';
import { exigirLocal, get, idProvisorio, post } from './http';

// DTOs do back (records Java) — nomes exatamente como lá
interface ClienteBackRequest {
  name: string;
  telefone: string;
  cnpj: string;
  email: string;
  limiteDeCredito: number;
  classificacao: ClienteCategoria;
}
interface ClienteBackCriarResponse {
  id: number;
  name: string;
  email: string;
  classificacao: ClienteCategoria;
}
/** O back ainda não devolve id nem cnpj na listagem (o pedido precisa deles). */
interface ClienteBackListar {
  id?: number;
  name: string;
  telefone: string;
  email: string;
  limiteDeCredito: number;
  classificacao: ClienteCategoria;
}

export async function cadastrarCliente(cliente: ClienteCriarRequest): Promise<ClienteCriarResponse | null> {
  if (USAR_DADOS_LOCAIS) return cadastrarClienteLocal(cliente);
  const corpo: ClienteBackRequest = {
    name: cliente.name,
    telefone: cliente.telefone,
    cnpj: cliente.cnpj.replace(/[^0-9a-z]/gi, '').toUpperCase(),
    email: cliente.email,
    limiteDeCredito: cliente.limiteCredito,
    classificacao: cliente.categoria,
  };
  const r = await post<ClienteBackCriarResponse>(ENDPOINTS.clientes, corpo);
  return r && { id: r.id, name: r.name, email: r.email, categoria: r.classificacao, limiteCredito: cliente.limiteCredito };
}

export async function listarClientes(): Promise<ClienteListarResponse[]> {
  if (USAR_DADOS_LOCAIS) return listarClientesLocal();
  const lista = await get<ClienteBackListar>(ENDPOINTS.clientes);
  return lista.map((c, i) => ({
    id: idProvisorio(c.id, i),
    name: c.name,
    telefone: c.telefone,
    email: c.email,
    categoria: c.classificacao,
    limiteCredito: Number(c.limiteDeCredito ?? 0),
  }));
}

export async function editarCliente(id: number, cliente: ClienteCriarRequest) {
  exigirLocal('Editar cliente');
  return editarClienteLocal(id, cliente);
}

export async function definirClienteAtivo(id: number, ativo: boolean) {
  exigirLocal(ativo ? 'Reativar cliente' : 'Desativar cliente');
  return definirClienteAtivoLocal(id, ativo);
}
