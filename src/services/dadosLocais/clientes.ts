/** Clientes nos dados locais, iguais ao ClienteService do back: cadastrar, listar, editar, excluir e reativar. */
import { estaInadimplente } from '../../regras';
import type {
  ClienteCriarRequest,
  ClienteCriarResponse,
  ClienteEditarRequest,
  ClienteListarResponse,
  ClienteSalvo,
} from '../../types';
import { ativos, CHAVE_CLIENTES, CHAVE_PEDIDOS, falha, ler, proximoId, salvar, substituir, type PedidoSalvo } from './armazenamento';
import { cnpjValido } from './validacao';

const normalizarCnpj = (cnpj: string) => cnpj.replace(/[^0-9a-z]/gi, '').toUpperCase();

/** Validações dos records (ClienteCriarRequest/ClienteEditarRequest): @Length, @CNPJ, @Email, @DecimalMin. */
function validarCampos(dados: ClienteCriarRequest): ClienteCriarRequest {
  const name = dados.name.trim();
  const cnpj = normalizarCnpj(dados.cnpj);
  const email = dados.email.trim();
  const limiteCredito = Number(dados.limiteCredito);
  if (name.length < 3 || name.length > 60) falha('O nome deve ter entre 3 e 60 caracteres.');
  if (!cnpjValido(cnpj)) falha('CNPJ inválido.');
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) falha('E-mail inválido.');
  if (!Number.isFinite(limiteCredito) || limiteCredito < 0) falha('Limite de crédito inválido.');
  return { ...dados, name, cnpj, email, telefone: dados.telefone.trim(), limiteCredito };
}

export async function cadastrarClienteLocal(entrada: ClienteCriarRequest): Promise<ClienteCriarResponse> {
  const dados = validarCampos(entrada);
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const desativado = clientes.find((c) => c.excluido && (c.cnpj === dados.cnpj || c.email === dados.email));
  if (desativado) {
    falha(`O cliente informado está desativado. Utilize o endpoint PUT /clientes/${desativado.id}/reativar para reativá-lo`);
  }
  if (ativos(clientes).some((c) => c.email === dados.email)) {
    falha(`A operação não foi executada pois o email informado: ${dados.email} ja esta cadastrado no sistema`);
  }
  if (ativos(clientes).some((c) => c.cnpj === dados.cnpj)) {
    falha(`A operação não foi executada pois o cliente informado CNPJ: ${dados.cnpj} ja esta cadastrado no sistema`);
  }
  const novo: ClienteSalvo = { ...dados, id: proximoId(clientes) };
  salvar(CHAVE_CLIENTES, [...clientes, novo]);
  return { id: novo.id, name: novo.name, email: novo.email, categoria: novo.categoria, limiteCredito: novo.limiteCredito };
}

/**
 * Listagem. O back devolve só os ativos e sem id/cnpj; aqui vêm também id, cnpj, a situação
 * (inadimplente) e os desativados (para poder reativar), que é o que pedimos para o back incluir.
 */
export async function listarClientesLocal(): Promise<ClienteListarResponse[]> {
  const pedidos = ativos(ler<PedidoSalvo>(CHAVE_PEDIDOS));
  return ler<ClienteSalvo>(CHAVE_CLIENTES).map(({ id, name, telefone, cnpj, email, categoria, limiteCredito, excluido }) => ({
    id,
    name,
    telefone,
    cnpj,
    email,
    categoria,
    limiteCredito,
    ativo: !excluido,
    inadimplente: estaInadimplente({ id }, pedidos),
  }));
}

/**
 * PUT /clientes/{id}/editar. O limite informado substitui o limite disponível (o back grava o que
 * vier). CNPJ e e-mail não podem estar em outro cliente ativo.
 */
export async function editarClienteLocal(id: number, entrada: ClienteEditarRequest): Promise<ClienteSalvo> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const atual = ativos(clientes).find((c) => c.id === id);
  if (!atual) falha(`A operação não foi executada pois o cliente informado id: ${id} não existe`);
  // O que não vem (limite, CNPJ vazio) continua como está, igual ao ClienteMapper do back (ignora nulos).
  const dados = validarCampos({
    ...entrada,
    cnpj: entrada.cnpj || atual.cnpj,
    limiteCredito: entrada.limiteCredito ?? atual.limiteCredito,
  });
  const outros = ativos(clientes).filter((c) => c.id !== id);
  if (outros.some((c) => c.cnpj === dados.cnpj)) falha(`O cnpj informado já está cadastrado em outro cliente ${dados.cnpj}`);
  if (outros.some((c) => c.email === dados.email)) falha(`O email informado já está cadastrado em outro cliente ${dados.email}`);
  return substituir(CHAVE_CLIENTES, clientes, { ...atual, ...dados });
}

/** DELETE /clientes/{id}: soft delete. Não deixa se o cliente tiver pedido pendente. */
export async function excluirClienteLocal(id: number): Promise<ClienteSalvo> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const atual = ativos(clientes).find((c) => c.id === id);
  if (!atual) falha(`A operação não foi executada pois o cliente informado id: ${id} não existe`);
  const pendente = ativos(ler<PedidoSalvo>(CHAVE_PEDIDOS)).some((p) => p.clienteId === id && p.statusPedido === 'PENDENTE');
  if (pendente) falha(`O cliente de id: ${id} não pode ser excluído pois possui pedidos pendentes em aberto`);
  return substituir(CHAVE_CLIENTES, clientes, { ...atual, excluido: true });
}

/** PUT /clientes/{id}/reativar. */
export async function reativarClienteLocal(id: number): Promise<ClienteSalvo> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const atual = clientes.find((c) => c.id === id);
  if (!atual) falha(`A operação não foi executada pois o cliente informado id: ${id} não existe`);
  return substituir(CHAVE_CLIENTES, clientes, { ...atual, excluido: false });
}
