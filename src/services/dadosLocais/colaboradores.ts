/** Colaboradores nos dados locais: cadastrar, listar, editar e desativar/reativar. */
import type { Colaborador, ColaboradorCriarRequest } from '../../types';
import { CHAVE_COLABORADORES, ler, proximoId, salvar, substituir } from './armazenamento';
import { cpfValido } from './validacao';

export async function listarColaboradoresLocal(): Promise<Colaborador[]> {
  return ler<Colaborador>(CHAVE_COLABORADORES).map((c) => ({ ...c, ativo: c.ativo !== false }));
}

/** Valida e normaliza os dados do colaborador (cadastro e edição). `idAtual` = colaborador sendo editado. */
function validarColaborador(dados: ColaboradorCriarRequest, colaboradores: Colaborador[], idAtual?: number) {
  const nome = dados.nome.trim();
  const cpf = dados.cpf.replace(/\D/g, '');
  const email = dados.email.trim();
  const outros = colaboradores.filter((c) => c.id !== idAtual);

  if (nome.length < 3) throw new Error('Informe o nome do colaborador.');
  if (!cpfValido(cpf)) throw new Error('CPF inválido.');
  if (outros.some((c) => c.cpf === cpf)) throw new Error('Já existe um colaborador com esse CPF.');
  if (outros.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Já existe um colaborador com esse e-mail.');
  }
  return { nome, cpf, email };
}

export async function cadastrarColaboradorLocal(dados: ColaboradorCriarRequest): Promise<Colaborador> {
  const colaboradores = ler<Colaborador>(CHAVE_COLABORADORES);
  const novo: Colaborador = { id: proximoId(colaboradores), ...validarColaborador(dados, colaboradores) };
  salvar(CHAVE_COLABORADORES, [...colaboradores, novo]);
  return novo;
}

/** As decisões de desconto já tomadas guardam o nome do colaborador daquele momento. */
export async function editarColaboradorLocal(id: number, dados: ColaboradorCriarRequest): Promise<Colaborador> {
  const colaboradores = ler<Colaborador>(CHAVE_COLABORADORES);
  const atual = colaboradores.find((c) => c.id === id);
  if (!atual) throw new Error('Colaborador não encontrado.');
  return substituir(CHAVE_COLABORADORES, colaboradores, { ...atual, ...validarColaborador(dados, colaboradores, id) });
}

/** Colaborador desativado não decide descontos; as decisões antigas continuam no histórico. */
export async function definirColaboradorAtivoLocal(id: number, ativo: boolean): Promise<Colaborador> {
  const colaboradores = ler<Colaborador>(CHAVE_COLABORADORES);
  const atual = colaboradores.find((c) => c.id === id);
  if (!atual) throw new Error('Colaborador não encontrado.');
  return substituir(CHAVE_COLABORADORES, colaboradores, { ...atual, ativo });
}
