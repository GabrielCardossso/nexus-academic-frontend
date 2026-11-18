/** Clientes nos dados locais: cadastrar, listar, editar e desativar/reativar. */
import { estaInadimplente } from '../../regras';
import type { ClienteCriarRequest, ClienteCriarResponse, ClienteListarResponse, ClienteSalvo, Pedido } from '../../types';
import { CHAVE_CLIENTES, CHAVE_PEDIDOS, ler, proximoId, salvar, substituir } from './armazenamento';
import { cnpjValido } from './validacao';

/** Valida e normaliza os dados do cliente (cadastro e edição). `idAtual` = cliente sendo editado. */
function validarCliente(dados: ClienteCriarRequest, clientes: ClienteSalvo[], idAtual?: number): ClienteCriarRequest {
  const name = dados.name.trim();
  const cnpj = dados.cnpj.replace(/[^0-9a-z]/gi, '').toUpperCase();
  const email = dados.email.trim();
  const limiteCredito = Number(dados.limiteCredito);

  if (name.length < 3) throw new Error('Informe o nome ou a razão social do cliente.');
  if (!cnpjValido(cnpj)) throw new Error('CNPJ inválido.');
  if (clientes.some((c) => c.id !== idAtual && c.cnpj === cnpj)) throw new Error('Já existe um cliente com esse CNPJ.');
  if (clientes.some((c) => c.id !== idAtual && c.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Já existe um cliente com esse e-mail.'); // coluna unique
  }
  if (!Number.isFinite(limiteCredito) || limiteCredito < 0) throw new Error('Limite de crédito inválido.');
  return { ...dados, name, cnpj, email, telefone: dados.telefone.trim(), limiteCredito };
}

export async function cadastrarClienteLocal(dados: ClienteCriarRequest): Promise<ClienteCriarResponse> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const novo: ClienteSalvo = { ...validarCliente(dados, clientes), id: proximoId(clientes) };
  salvar(CHAVE_CLIENTES, [...clientes, novo]);
  return {
    id: novo.id,
    name: novo.name,
    email: novo.email,
    categoria: novo.categoria,
    limiteCredito: novo.limiteCredito,
  };
}

export async function listarClientesLocal(): Promise<ClienteListarResponse[]> {
  const pedidos = ler<Pedido>(CHAVE_PEDIDOS);
  return ler<ClienteSalvo>(CHAVE_CLIENTES).map(
    ({ id, name, telefone, cnpj, email, categoria, limiteCredito, ativo }) => ({
      id,
      name,
      telefone,
      cnpj,
      email,
      categoria,
      limiteCredito,
      ativo: ativo !== false,
      inadimplente: estaInadimplente(id, pedidos),
    }),
  );
}

/**
 * Edita os dados do cliente. O limite informado é o limite **disponível** (o que a tela mostra).
 * Os pedidos já feitos guardam o nome e a categoria do momento do pedido.
 */
export async function editarClienteLocal(id: number, dados: ClienteCriarRequest): Promise<ClienteSalvo> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const atual = clientes.find((c) => c.id === id);
  if (!atual) throw new Error('Cliente não encontrado.');
  return substituir(CHAVE_CLIENTES, clientes, { ...atual, ...validarCliente(dados, clientes, id) });
}

/** Nada é excluído de verdade: o cliente desativado some da escolha de pedido novo, e pode ser reativado. */
export async function definirClienteAtivoLocal(id: number, ativo: boolean): Promise<ClienteSalvo> {
  const clientes = ler<ClienteSalvo>(CHAVE_CLIENTES);
  const atual = clientes.find((c) => c.id === id);
  if (!atual) throw new Error('Cliente não encontrado.');
  return substituir(CHAVE_CLIENTES, clientes, { ...atual, ativo });
}
