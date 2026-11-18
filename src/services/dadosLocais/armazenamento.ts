/**
 * Onde os dados locais ficam guardados (localStorage) e os ajudantes usados por todos os arquivos
 * desta pasta: ler, salvar, gerar id, trocar um registro e ajustar o limite de crédito.
 * Para limpar os dados: F12 > Application > Local Storage > apagar "nexus:*".
 */
import { CARREGAR_MOCKS } from '../../config/api';
import { estaInadimplente } from '../../regras';
import type { ClienteSalvo, Pedido } from '../../types';
import { arredondar } from '../../utils';
import { COLABORADORES_MOCK, gerarMocks } from './mocks';

// "v8": dados de exemplo com as regras novas (inadimplente sem desconto, cancelados e desativados).
// Dados de versões antigas ficam de lado e os de exemplo são recriados.
export const CHAVE_CLIENTES = 'nexus:v8:clientes';
export const CHAVE_PRODUTOS = 'nexus:v8:produtos';
export const CHAVE_PEDIDOS = 'nexus:v8:pedidos';
export const CHAVE_COLABORADORES = 'nexus:v8:colaboradores';

/** Primeira execução (nada salvo ainda): grava os dados de exemplo de mocks.ts. */
function carregarMocksSeVazio() {
  try {
    // Colaboradores têm chave própria (vieram depois): os de exemplo entram mesmo se o resto já existir,
    // porque as decisões de desconto dos pedidos de exemplo apontam para eles.
    if (CARREGAR_MOCKS && localStorage.getItem(CHAVE_COLABORADORES) === null) {
      salvar(CHAVE_COLABORADORES, COLABORADORES_MOCK);
    }
    const vazio = [CHAVE_CLIENTES, CHAVE_PRODUTOS, CHAVE_PEDIDOS].every((c) => localStorage.getItem(c) === null);
    if (!CARREGAR_MOCKS || !vazio) return;
    const { clientes, produtos, pedidos } = gerarMocks();
    salvar(CHAVE_CLIENTES, clientes);
    salvar(CHAVE_PRODUTOS, produtos);
    salvar(CHAVE_PEDIDOS, pedidos);
  } catch {
    // localStorage indisponível: segue sem mocks
  }
}

export function ler<T>(chave: string): T[] {
  carregarMocksSeVazio();
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T[]) : [];
  } catch {
    return [];
  }
}

export function salvar<T>(chave: string, itens: T[]) {
  localStorage.setItem(chave, JSON.stringify(itens));
}

/**
 * Lê os pedidos com a situação do cliente preenchida: nos ainda não pagos, a situação atual
 * (inadimplente ou em dia); nos pagos ou cancelados, fica a situação gravada naquele momento.
 */
export function lerPedidos(): Pedido[] {
  const pedidos = ler<Pedido>(CHAVE_PEDIDOS);
  return pedidos.map((p) =>
    p.pagoEm || p.canceladoEm ? p : { ...p, clienteInadimplente: estaInadimplente(p.clienteId, pedidos) },
  );
}

/** Simula o @GeneratedValue(IDENTITY): maior id atual + 1. */
export function proximoId(itens: { id: number }[]): number {
  return itens.reduce((maior, item) => Math.max(maior, item.id), 0) + 1;
}

/** Troca um registro (pelo id) e salva a lista. */
export function substituir<T extends { id: number }>(chave: string, lista: T[], atualizado: T): T {
  salvar(chave, lista.map((x) => (x.id === atualizado.id ? atualizado : x)));
  return atualizado;
}

/** Soma ao limite de crédito do cliente (valor negativo desconta). */
export function ajustarCredito(clienteId: number, valor: number) {
  salvar(
    CHAVE_CLIENTES,
    ler<ClienteSalvo>(CHAVE_CLIENTES).map((c) =>
      c.id === clienteId ? { ...c, limiteCredito: arredondar(c.limiteCredito + valor) } : c,
    ),
  );
}
