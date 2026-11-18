/** Colaboradores: back real (POST/GET /colaboradores) ou dados locais, conforme USAR_DADOS_LOCAIS. */
import { ENDPOINTS, USAR_DADOS_LOCAIS } from '../../config/api';
import type { Colaborador, ColaboradorCriarRequest } from '../../types';
import {
  cadastrarColaboradorLocal,
  definirColaboradorAtivoLocal,
  editarColaboradorLocal,
  listarColaboradoresLocal,
} from '../dadosLocais';
import { exigirLocal, get, idProvisorio, post } from './http';

// DTO do back (record Java) — nomes exatamente como lá
interface ColaboradorBack {
  id?: number; // o back ainda não devolve id na listagem (a aprovação de desconto precisa dele)
  name: string;
  cpf: string;
  email: string;
}

export async function listarColaboradores(): Promise<Colaborador[]> {
  if (USAR_DADOS_LOCAIS) return listarColaboradoresLocal();
  const lista = await get<ColaboradorBack>(ENDPOINTS.colaboradores);
  return lista.map((c, i) => ({ id: idProvisorio(c.id, i), nome: c.name, cpf: c.cpf, email: c.email }));
}

export async function cadastrarColaborador(colaborador: ColaboradorCriarRequest): Promise<Colaborador> {
  if (USAR_DADOS_LOCAIS) return cadastrarColaboradorLocal(colaborador);
  const corpo: ColaboradorBack = {
    name: colaborador.nome.trim(),
    cpf: colaborador.cpf.replace(/\D/g, ''),
    email: colaborador.email.trim(),
  };
  const r = await post<ColaboradorBack>(ENDPOINTS.colaboradores, corpo);
  return { id: r?.id ?? -1, nome: r?.name ?? corpo.name, cpf: r?.cpf ?? corpo.cpf, email: r?.email ?? corpo.email };
}

export async function editarColaborador(id: number, colaborador: ColaboradorCriarRequest) {
  exigirLocal('Editar colaborador');
  return editarColaboradorLocal(id, colaborador);
}

export async function definirColaboradorAtivo(id: number, ativo: boolean) {
  exigirLocal(ativo ? 'Reativar colaborador' : 'Desativar colaborador');
  return definirColaboradorAtivoLocal(id, ativo);
}
