/**
 * Descontos, iguais ao PedidoService do back (criar, editarPedido e resolverSolicitacaoDesconto).
 * Os valores são frações: 0.05 = 5%. O front mostra em % e converte ao enviar.
 */
import type { ClienteCategoria, StatusAprovacaoDesconto } from '../types';

export const DESCONTO_VIP = 0.05; // VIP pedindo até 5% recebe 5% aprovado na hora
export const TETO_NORMAL = 0.1; // NORMAL pedindo 10% ou mais é cortado para 10% (sem erro)
export const DESCONTO_MAXIMO = 0.15; // @DecimalMax("0.15") do PedidoCriarRequest

/**
 * REGRA NOVA (2026-11-25; o Lucas vai levar ao back): só dá para pedir 0, 5, 10 ou 15% de desconto,
 * nada entre eles. O cliente NORMAL não pode pedir 15% (só 5% ou 10%).
 */
export const DESCONTOS_PERMITIDOS = [0.05, 0.1, 0.15] as const;

/** Descontos que o cliente pode pedir (sem contar o 0, que é "sem desconto"). */
export const opcoesDesconto = (categoria: ClienteCategoria): number[] =>
  DESCONTOS_PERMITIDOS.filter((d) => categoria === 'VIP' || d <= TETO_NORMAL);

/** 0 ou um dos DESCONTOS_PERMITIDOS (com folga para erro de ponto flutuante). */
export const descontoPermitido = (d: number) => d === 0 || DESCONTOS_PERMITIDOS.some((o) => Math.abs(o - d) < 1e-9);

/** Os campos de desconto de um pedido (como na entidade Pedido do back). */
export interface EstadoDesconto {
  descontoSolicitado: number;
  descontoAutorizado: number;
  statusAprovacaoDesconto: StatusAprovacaoDesconto;
  /** true = o colaborador que decidiu deixa de valer (o back zera colaboradorDesconto). */
  limparColaborador?: boolean;
  /** true = o back grava a data de hoje em dataAtualizacaoDesconto. */
  atualizarData?: boolean;
}

/** gerarDescontoSolicitadoBaseadoClassificacaoCliente: abaixo de 10% fica igual; NORMAL é cortado em 10%. */
export function descontoSolicitadoEfetivo(solicitado: number, categoria: ClienteCategoria): number {
  if (solicitado < TETO_NORMAL) return solicitado;
  return categoria === 'VIP' ? solicitado : TETO_NORMAL;
}

/** Desconto de um pedido novo (PedidoService.criar). */
export function descontoNaCriacao(solicitado: number, categoria: ClienteCategoria, inadimplente: boolean): EstadoDesconto {
  const descontoSolicitado = descontoSolicitadoEfetivo(solicitado, categoria);
  if (inadimplente) {
    return { descontoSolicitado, descontoAutorizado: 0, statusAprovacaoDesconto: 'REPROVADO_INADIPLENCIA' };
  }
  if (solicitado === 0 && categoria === 'NORMAL') {
    return { descontoSolicitado, descontoAutorizado: 0, statusAprovacaoDesconto: 'NAO_SOLICITADO' };
  }
  if (solicitado <= DESCONTO_VIP && categoria === 'VIP') {
    return {
      descontoSolicitado,
      descontoAutorizado: DESCONTO_VIP,
      statusAprovacaoDesconto: 'APROVADO_AUTOMATICAMENTE',
      atualizarData: true,
    };
  }
  // NORMAL pedindo qualquer valor e VIP pedindo mais de 5%: aguarda um colaborador, sem desconto até lá.
  return { descontoSolicitado, descontoAutorizado: 0, statusAprovacaoDesconto: 'PENDENTE' };
}

/**
 * Desconto na edição (PedidoService.editarPedido). `novo` undefined = o desconto não foi enviado
 * e nada muda. A situação de inadimplência NÃO é recalculada na edição (igual ao back).
 */
export function descontoNaEdicao(atual: EstadoDesconto, novo: number | undefined, categoria: ClienteCategoria): EstadoDesconto {
  if (novo === undefined) return { ...atual };
  const solicitado = descontoSolicitadoEfetivo(novo, categoria);
  const r: EstadoDesconto = { ...atual, descontoSolicitado: solicitado };
  const reprovadoInadimplencia = atual.statusAprovacaoDesconto === 'REPROVADO_INADIPLENCIA';

  if (solicitado > atual.descontoAutorizado) {
    if (categoria === 'VIP' && solicitado <= DESCONTO_VIP && !reprovadoInadimplencia) {
      return { ...r, descontoAutorizado: DESCONTO_VIP, statusAprovacaoDesconto: 'APROVADO_AUTOMATICAMENTE', atualizarData: true };
    }
    if (!reprovadoInadimplencia) return { ...r, statusAprovacaoDesconto: 'PENDENTE', limparColaborador: true };
    return r;
  }
  if (atual.statusAprovacaoDesconto === 'PENDENTE') {
    if (solicitado === 0 && categoria === 'NORMAL') {
      return { ...r, statusAprovacaoDesconto: 'NAO_SOLICITADO', limparColaborador: true };
    }
    if (categoria === 'VIP' && solicitado <= DESCONTO_VIP) {
      return {
        ...r,
        descontoAutorizado: DESCONTO_VIP,
        statusAprovacaoDesconto: 'APROVADO_AUTOMATICAMENTE',
        limparColaborador: true,
        atualizarData: true,
      };
    }
    return { ...r, limparColaborador: true };
  }
  // Pedindo igual ou menos do que já está autorizado (ex.: aprovado 12%, agora pede 8%): o back
  // mantém o desconto autorizado.
  return r;
}

/**
 * Decisão do colaborador (PedidoService.resolverSolicitacaoDesconto): APROVADO vale o que foi
 * solicitado; REPROVADO volta a 5% no VIP e não muda nada no NORMAL.
 */
export function descontoAutorizadoNaDecisao(
  atual: Pick<EstadoDesconto, 'descontoSolicitado' | 'descontoAutorizado'>,
  aprovar: boolean,
  categoria: ClienteCategoria,
): number {
  if (aprovar) return atual.descontoSolicitado;
  return categoria === 'VIP' ? DESCONTO_VIP : atual.descontoAutorizado;
}

/** Desconto solicitado ainda sem decisão de um colaborador (bloqueia "Finalizar"). */
export const aguardaDesconto = (p: { statusAprovacaoDesconto: StatusAprovacaoDesconto }) =>
  p.statusAprovacaoDesconto === 'PENDENTE';

/** Decisão tomada por um colaborador (aparece na aba "Decididas"). */
export const decididoPorColaborador = (s: StatusAprovacaoDesconto) => s === 'APROVADO' || s === 'REPROVADO';

/** 0.05 → "5%", 0.125 → "12,5%". */
export function percentual(fracao: number | undefined | null): string {
  const valor = Math.round((fracao ?? 0) * 10000) / 100;
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}
