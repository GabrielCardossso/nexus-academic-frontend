/**
 * Regras de negócio de pedido/desconto, em funções puras.
 * Usadas pela tela (prévia do pedido) e pelos dados locais.
 */
import type {
  ClienteCategoria,
  FormaPagamento,
  ItemPedido,
  SolicitacaoDesconto,
  StatusPagamento,
  StatusPedido,
  TipoPedido,
} from './types';

export const PRAZO_DIAS = 30; // vencimento do pedido "a prazo"
export const DESCONTO_VIP = 5;

export const ROTULO_PAGAMENTO: Record<FormaPagamento, string> = {
  PIX: 'PIX',
  A_VISTA: 'À vista',
  A_PRAZO: 'A prazo',
};

export const ROTULO_TIPO: Record<TipoPedido, string> = {
  VENDA: 'Venda',
  ALUGUEL: 'Aluguel',
};

export const ROTULO_STATUS_PEDIDO: Record<StatusPedido, string> = {
  PENDENTE: 'Pendente',
  CONCLUIDO: 'Concluído',
  DEVOLVIDO: 'Devolvido',
};

export const ROTULO_STATUS_PAGAMENTO: Record<StatusPagamento, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
};

interface DadosPedido {
  itens: ItemPedido[];
  clienteCategoria: ClienteCategoria;
  pagamento: FormaPagamento;
  meses?: number; // só aluguel: o valor é preço por mês × meses × quantidade
  solicitacao?: SolicitacaoDesconto;
  concluidoEm?: string;
  devolvidoEm?: string;
  pagoEm?: string;
  clienteInadimplente?: boolean; // inadimplente perde os 5% automáticos de VIP
}

type EstadoPedido = Pick<DadosPedido, 'solicitacao' | 'concluidoEm' | 'devolvidoEm'>;

type PedidoComPrazo = Pick<DadosPedido, 'pagamento' | 'pagoEm'> & { clienteId: number; vencimento: string };

/** Pedido a prazo que passou do vencimento sem pagamento (na data `em`, padrão: agora). */
export function estaVencido(p: PedidoComPrazo, em: Date = new Date()): boolean {
  const pagoAte = p.pagoEm != null && new Date(p.pagoEm) <= em;
  return p.pagamento === 'A_PRAZO' && !pagoAte && new Date(p.vencimento) < em;
}

/** Inadimplente: tem pelo menos um pedido a prazo vencido e não pago. */
export function estaInadimplente(clienteId: number, pedidos: PedidoComPrazo[], em: Date = new Date()): boolean {
  return pedidos.some((p) => p.clienteId === clienteId && estaVencido(p, em));
}

/**
 * Faixa (em %, inteiros) que o cliente pode solicitar.
 * NORMAL: 1–10. VIP em dia: 10–15 (já tem 5% garantido; se aprovado, substitui).
 * VIP inadimplente: 1–15 (perdeu os 5% automáticos).
 */
export function faixaDesconto(categoria: ClienteCategoria, inadimplente = false): { min: number; max: number } {
  if (categoria === 'NORMAL') return { min: 1, max: 10 };
  return inadimplente ? { min: 1, max: 15 } : { min: 10, max: 15 };
}

/** Mensagem de erro se o percentual estiver fora da faixa; null se for válido. */
export function erroDesconto(percentual: number, categoria: ClienteCategoria, inadimplente = false): string | null {
  const { min, max } = faixaDesconto(categoria, inadimplente);
  if (!Number.isInteger(percentual) || percentual < min || percentual > max) {
    return `O desconto solicitado deve ser um número inteiro de ${min}% a ${max}%.`;
  }
  return null;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

export function resumoPedido(p: DadosPedido) {
  const meses = p.meses ?? 1;
  const subtotal = arredondar(
    p.itens.reduce((soma, i) => soma + i.precoUnitario * i.quantidade, 0) * meses,
  );

  // Solicitação APROVADA vale o percentual pedido (no VIP substitui os 5%, não soma).
  // Sem aprovação: VIP em dia fica com os 5% automáticos; NORMAL e inadimplente ficam sem desconto.
  const percentual =
    p.solicitacao?.status === 'APROVADA'
      ? p.solicitacao.percentual
      : p.clienteCategoria === 'VIP' && !p.clienteInadimplente
        ? DESCONTO_VIP
        : 0;

  const valorDesconto = arredondar((subtotal * percentual) / 100);
  const total = arredondar(subtotal - valorDesconto);

  const statusPagamento: StatusPagamento = p.pagoEm ? 'PAGO' : 'PENDENTE';

  return { subtotal, percentual, valorDesconto, total, statusPagamento, statusPedido: statusDoPedido(p) };
}

/** O pedido nunca conclui sozinho: só com `concluidoEm` (botão "Confirmar pedido"). */
export function statusDoPedido(p: EstadoPedido): StatusPedido {
  if (p.devolvidoEm) return 'DEVOLVIDO';
  if (p.concluidoEm) return 'CONCLUIDO';
  return 'PENDENTE';
}

/** Desconto solicitado ainda sem decisão de um colaborador. */
export const aguardaDesconto = (p: Pick<DadosPedido, 'solicitacao'>) => p.solicitacao?.status === 'PENDENTE';

/** Pode confirmar: está pendente e não depende de aprovação de desconto. */
export const podeConfirmar = (p: EstadoPedido) => statusDoPedido(p) === 'PENDENTE' && !aguardaDesconto(p);

/** PIX/à vista é pago na hora, exceto se ainda aguarda aprovação de desconto (aí é pago na decisão). */
export const pagoNaHora = (p: Pick<DadosPedido, 'pagamento' | 'solicitacao'>) =>
  p.pagamento !== 'A_PRAZO' && !aguardaDesconto(p);

/** Pedido a prazo ainda não pago e sem desconto aguardando decisão pode ter o pagamento registrado. */
export const podePagar = (p: Pick<DadosPedido, 'pagamento' | 'solicitacao' | 'pagoEm'>) =>
  p.pagamento === 'A_PRAZO' && !p.pagoEm && !aguardaDesconto(p);

/** Só aluguel já concluído e ainda não devolvido pode ser devolvido. */
export const podeDevolver = (p: EstadoPedido & { tipo: TipoPedido }) =>
  p.tipo === 'ALUGUEL' && statusDoPedido(p) === 'CONCLUIDO';

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
