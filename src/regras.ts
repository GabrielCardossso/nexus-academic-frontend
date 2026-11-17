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
}

type EstadoPedido = Pick<DadosPedido, 'solicitacao' | 'concluidoEm' | 'devolvidoEm'>;

const arredondar = (n: number) => Math.round(n * 100) / 100;

export function resumoPedido(p: DadosPedido) {
  const meses = p.meses ?? 1;
  const subtotal = arredondar(
    p.itens.reduce((soma, i) => soma + i.precoUnitario * i.quantidade, 0) * meses,
  );

  // VIP: 5% automático. NORMAL: só depois de APROVADA.
  const percentual =
    p.clienteCategoria === 'VIP'
      ? DESCONTO_VIP
      : p.solicitacao?.status === 'APROVADA'
        ? p.solicitacao.percentual
        : 0;

  const valorDesconto = arredondar((subtotal * percentual) / 100);
  const total = arredondar(subtotal - valorDesconto);

  // Pagamento: pago na hora (PIX/à vista), exceto se ainda aguarda aprovação de desconto.
  const statusPagamento: StatusPagamento =
    p.pagamento === 'A_PRAZO' || p.solicitacao?.status === 'PENDENTE' ? 'PENDENTE' : 'PAGO';

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
