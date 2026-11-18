/** Descontos: automático de VIP, faixas de solicitação e textos da decisão. */
import type { ClienteCategoria, SolicitacaoDesconto } from '../types';
import { MSG_INADIMPLENTE_SEM_DESCONTO } from './mensagens';

export const DESCONTO_VIP = 5; // % automático do VIP em dia, em qualquer forma de pagamento

/**
 * Faixa (em %, inteiros) que o cliente pode solicitar.
 * NORMAL: 1–10. VIP em dia: 10–15 (já tem 5% garantido; se aprovado, substitui).
 * Inadimplente (Normal ou VIP) não solicita: ver erroDesconto.
 */
export function faixaDesconto(categoria: ClienteCategoria): { min: number; max: number } {
  return categoria === 'NORMAL' ? { min: 1, max: 10 } : { min: 10, max: 15 };
}

/** Mensagem de erro se o cliente não pode solicitar ou o percentual está fora da faixa; null se for válido. */
export function erroDesconto(percentual: number, categoria: ClienteCategoria, inadimplente = false): string | null {
  if (inadimplente) return MSG_INADIMPLENTE_SEM_DESCONTO;
  const { min, max } = faixaDesconto(categoria);
  if (!Number.isInteger(percentual) || percentual < min || percentual > max) {
    return `O desconto solicitado deve ser um número inteiro de ${min}% a ${max}%.`;
  }
  return null;
}

/** Desconto solicitado ainda sem decisão de um colaborador. */
export const aguardaDesconto = (p: { solicitacao?: SolicitacaoDesconto }) => p.solicitacao?.status === 'PENDENTE';

export function mensagemRejeicao(s: SolicitacaoDesconto): string {
  return `Solicitação de desconto de ${s.percentual}% rejeitada por ${s.colaboradorNome} (ID ${s.colaboradorId}).`;
}

/** Linhas de texto para mostrar a solicitação (status, quem decidiu, mensagem de rejeição). */
export function linhasSolicitacao(s: SolicitacaoDesconto): string[] {
  const base = `Solicitação de desconto (${s.percentual}%): ${s.status}`;
  if (s.status === 'APROVADA') return [`${base} por ${s.colaboradorNome} (ID ${s.colaboradorId})`];
  if (s.status === 'REJEITADA') return [base, mensagemRejeicao(s)];
  return [base];
}
