/** Colaboradores nos dados locais, iguais ao ColaboradorService do back: cadastrar, listar, editar, excluir e reativar. */
import type { Colaborador, ColaboradorCriarRequest } from '../../types';
import {
  ativos,
  CHAVE_COLABORADORES,
  falha,
  ler,
  proximoId,
  salvar,
  substituir,
  type ColaboradorSalvo,
} from './armazenamento';
import { cpfValido } from './validacao';

const naoExiste = (id: number): never =>
  falha(`A operação não foi executada pois colaborador com id informado: ${id} não existe`);

/** Listagem. O back devolve só os ativos e sem id; aqui vêm também o id e os desativados (para reativar). */
export async function listarColaboradoresLocal(): Promise<Colaborador[]> {
  return ler<ColaboradorSalvo>(CHAVE_COLABORADORES).map(({ excluido, ...c }) => ({ ...c, ativo: !excluido }));
}

/** Validações dos records (@NotBlank, @CPF, @Email) e da entidade (nome de 3 a 60 caracteres). */
function validarCampos(dados: ColaboradorCriarRequest) {
  const nome = dados.nome.trim();
  const cpf = dados.cpf.replace(/\D/g, '');
  const email = dados.email.trim();
  if (nome.length < 3 || nome.length > 60) falha('O nome deve ter entre 3 e 60 caracteres.');
  if (!cpfValido(cpf)) falha('CPF inválido.');
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) falha('E-mail inválido.');
  return { nome, cpf, email };
}

/**
 * POST /colaboradores. O back não deixa repetir nome nem e-mail. CPF repetido o back só confere na
 * edição; no cadastro quem confere é a tela (trava do front, ver ColaboradoresTela).
 */
export async function cadastrarColaboradorLocal(entrada: ColaboradorCriarRequest): Promise<Colaborador> {
  const dados = validarCampos(entrada);
  const colaboradores = ler<ColaboradorSalvo>(CHAVE_COLABORADORES);
  const desativado = colaboradores.find((c) => c.excluido && (c.nome === dados.nome || c.email === dados.email));
  if (desativado) {
    falha(`O colaborador informado está desativado. Utilize o endpoint PUT /colaboradores/${desativado.id}/reativar para reativá-lo`);
  }
  const ativosAgora = ativos(colaboradores);
  if (ativosAgora.some((c) => c.nome === dados.nome)) {
    falha(`A operação não foi executada pois o colaborador: ${dados.nome} ja esta cadastrado no sistema`);
  }
  if (ativosAgora.some((c) => c.email === dados.email)) {
    falha(`O email informado já está cadastrado em outro colaborador. Email:  ${dados.email}`);
  }
  const novo: ColaboradorSalvo = { id: proximoId(colaboradores), ...dados };
  salvar(CHAVE_COLABORADORES, [...colaboradores, novo]);
  return { ...novo, ativo: true };
}

/** PUT /colaboradores/{id}/editar. Nome, CPF e e-mail não podem estar em outro colaborador ativo. */
export async function editarColaboradorLocal(id: number, entrada: ColaboradorCriarRequest): Promise<Colaborador> {
  const colaboradores = ler<ColaboradorSalvo>(CHAVE_COLABORADORES);
  const atual = ativos(colaboradores).find((c) => c.id === id) ?? naoExiste(id);
  const dados = validarCampos(entrada);
  const outros = ativos(colaboradores).filter((c) => c.id !== id);
  if (outros.some((c) => c.nome === dados.nome)) {
    falha(`A operação não foi executada pois o colaborador: ${dados.nome} ja esta cadastrado no sistema`);
  }
  if (outros.some((c) => c.cpf === dados.cpf)) falha(`O cpf informado já está cadastrado em outro colaborador. CPF:  ${dados.cpf}`);
  if (outros.some((c) => c.email === dados.email)) {
    falha(`O email informado já está cadastrado em outro colaborador. Email:  ${dados.email}`);
  }
  return { ...substituir(CHAVE_COLABORADORES, colaboradores, { ...atual, ...dados }), ativo: true };
}

/** DELETE /colaboradores/{id}: soft delete. As decisões de desconto antigas continuam com o nome dele. */
export async function excluirColaboradorLocal(id: number): Promise<Colaborador> {
  const colaboradores = ler<ColaboradorSalvo>(CHAVE_COLABORADORES);
  const atual = ativos(colaboradores).find((c) => c.id === id) ?? naoExiste(id);
  return { ...substituir(CHAVE_COLABORADORES, colaboradores, { ...atual, excluido: true }), ativo: false };
}

/** PUT /colaboradores/{id}/reativar. */
export async function reativarColaboradorLocal(id: number): Promise<Colaborador> {
  const colaboradores = ler<ColaboradorSalvo>(CHAVE_COLABORADORES);
  const atual = colaboradores.find((c) => c.id === id) ?? naoExiste(id);
  return { ...substituir(CHAVE_COLABORADORES, colaboradores, { ...atual, excluido: false }), ativo: true };
}
