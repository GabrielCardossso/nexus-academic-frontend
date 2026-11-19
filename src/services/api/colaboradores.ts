/** Colaboradores: back real (/colaboradores) ou dados locais, conforme USAR_DADOS_LOCAIS. */
import { ENDPOINTS, USAR_DADOS_LOCAIS } from '../../config/api';
import type { Colaborador, ColaboradorCriarRequest } from '../../types';
import {
  cadastrarColaboradorLocal,
  editarColaboradorLocal,
  excluirColaboradorLocal,
  listarColaboradoresLocal,
  reativarColaboradorLocal,
} from '../dadosLocais';
import { del, getLista, post, put } from './http';

/** dtos/ColaboradorCriarRequest.java e ColaboradorListarResponse.java. */
interface ColaboradorBack {
  id?: number; // vem na listagem; no cadastro (POST) o front não manda
  name: string;
  cpf: string;
  email: string;
}

const paraBack = (c: ColaboradorCriarRequest): ColaboradorBack => ({
  name: c.nome.trim(),
  cpf: c.cpf.replace(/\D/g, ''),
  email: c.email.trim(),
});

/** GET /colaboradores (só os ativos no back). */
export async function listarColaboradores(): Promise<Colaborador[]> {
  if (USAR_DADOS_LOCAIS) return listarColaboradoresLocal();
  const lista = await getLista<ColaboradorBack>(ENDPOINTS.colaboradores);
  return lista.map((c) => ({ id: c.id!, nome: c.name, cpf: c.cpf, email: c.email }));
}

/** POST /colaboradores */
export async function cadastrarColaborador(colaborador: ColaboradorCriarRequest): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await cadastrarColaboradorLocal(colaborador);
    return;
  }
  await post(ENDPOINTS.colaboradores, paraBack(colaborador));
}

/** PUT /colaboradores/{id}/editar */
export async function editarColaborador(id: number, colaborador: ColaboradorCriarRequest): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await editarColaboradorLocal(id, colaborador);
    return;
  }
  await put(ENDPOINTS.colaboradorEditar(id), paraBack(colaborador));
}

/** DELETE /colaboradores/{id} (soft delete: some da listagem). */
export async function excluirColaborador(id: number): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await excluirColaboradorLocal(id);
    return;
  }
  await del(ENDPOINTS.colaborador(id));
}

/** PUT /colaboradores/{id}/reativar */
export async function reativarColaborador(id: number): Promise<void> {
  if (USAR_DADOS_LOCAIS) {
    await reativarColaboradorLocal(id);
    return;
  }
  await put(ENDPOINTS.colaboradorReativar(id));
}
