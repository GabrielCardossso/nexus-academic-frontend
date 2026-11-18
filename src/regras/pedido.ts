/**
 * Pedido: cálculo do total, status e o que cada pedido pode fazer (confirmar, pagar, editar, cancelar, devolver).
 * Total, desconto e status nunca ficam salvos: são sempre calculados aqui.
 */
import type {
  ClienteCategoria,
  FormaPagamento,
  ItemPedido,
  SolicitacaoDesconto,
  StatusPagamento,
  StatusPedido,
  TipoPedido,
} from '../types';
import { arredondar } from '../utils';
import { aguardaDesconto, DESCONTO_VIP } from './descontos';
import { estaVencido, type PedidoComPrazo } from './inadimplencia';

/** O que o cálculo do pedido precisa (serve para o pedido salvo e para a prévia do formulário). */
interface DadosPedido {
  itens: ItemPedido[];
  clienteCategoria: ClienteCategoria;
  pagamento: FormaPagamento;
  meses?: number; // só aluguel: o valor é preço por mês × meses × quantidade
  solicitacao?: SolicitacaoDesconto;
  concluidoEm?: string;
  devolvidoEm?: string;
  canceladoEm?: string; // cancelado (o "excluir" do pedido): não volta atrás
  pagoEm?: string;
  clienteInadimplente?: boolean; // inadimplente fica sem desconto nenhum
}

type EstadoPedido = Pick<DadosPedido, 'solicitacao' | 'concluidoEm' | 'devolvidoEm' | 'canceladoEm'>;

export function resumoPedido(p: DadosPedido) {
  const meses = p.meses ?? 1;
  const subtotal = arredondar(p.itens.reduce((soma, i) => soma + i.precoUnitario * i.quantidade, 0) * meses);

  // Inadimplente: nenhum desconto (nem os 5% de VIP, nem solicitação aprovada).
  // Solicitação APROVADA vale o percentual pedido (no VIP substitui os 5%, não soma).
  // Sem aprovação: VIP fica com os 5% automáticos; NORMAL fica sem desconto.
  const percentual = p.clienteInadimplente
    ? 0
    : p.solicitacao?.status === 'APROVADA'
      ? p.solicitacao.percentual
      : p.clienteCategoria === 'VIP'
        ? DESCONTO_VIP
        : 0;

  const valorDesconto = arredondar((subtotal * percentual) / 100);
  const total = arredondar(subtotal - valorDesconto);

  const statusPagamento: StatusPagamento = p.pagoEm ? 'PAGO' : 'PENDENTE';

  return { subtotal, percentual, valorDesconto, total, statusPagamento, statusPedido: statusDoPedido(p) };
}

/** Total do pedido como o cliente inadimplente pagaria (sem desconto nenhum). */
export const totalSemDesconto = (p: DadosPedido) => resumoPedido({ ...p, clienteInadimplente: true }).total;

/** O pedido nunca conclui sozinho: só com `concluidoEm` (botão "Confirmar pedido"). */
export function statusDoPedido(p: EstadoPedido): StatusPedido {
  if (p.canceladoEm) return 'CANCELADO';
  if (p.devolvidoEm) return 'DEVOLVIDO';
  if (p.concluidoEm) return 'CONCLUIDO';
  return 'PENDENTE';
}

type ConteudoPedido = {
  tipo: TipoPedido;
  pagamento: FormaPagamento;
  meses?: number;
  itens: { produtoId: number; quantidade: number }[];
};

/**
 * Na edição: tipo, pagamento, meses, produtos e quantidades iguais aos do pedido original.
 * Só assim uma decisão de desconto já tomada continua valendo (senão volta a ficar pendente).
 */
export function mesmoConteudo(a: ConteudoPedido, b: ConteudoPedido): boolean {
  const chave = (p: ConteudoPedido) =>
    [p.tipo, p.pagamento, p.tipo === 'ALUGUEL' ? p.meses : '', ...p.itens.map((i) => `${i.produtoId}:${i.quantidade}`).sort()].join('|');
  return chave(a) === chave(b);
}

// ---------------- O que o pedido pode fazer ----------------

/** Pode confirmar: está pendente e não depende de aprovação de desconto. */
export const podeConfirmar = (p: EstadoPedido) => statusDoPedido(p) === 'PENDENTE' && !aguardaDesconto(p);

/** PIX/à vista é pago na hora, exceto se ainda aguarda aprovação de desconto (aí é pago na decisão). */
export const pagoNaHora = (p: Pick<DadosPedido, 'pagamento' | 'solicitacao'>) =>
  p.pagamento !== 'A_PRAZO' && !aguardaDesconto(p);

/** Pedido a prazo ainda não pago e sem desconto aguardando decisão pode ter o pagamento registrado. */
export const podePagar = (p: Pick<DadosPedido, 'pagamento' | 'solicitacao' | 'pagoEm' | 'canceladoEm'>) =>
  p.pagamento === 'A_PRAZO' && !p.pagoEm && !p.canceladoEm && !aguardaDesconto(p);

/**
 * Edição: só antes do pagamento (vale também para pedido já confirmado). A prazo, até registrar o
 * pagamento; PIX/à vista já nascem pagos, então só editam enquanto o desconto aguarda decisão.
 * Aluguel devolvido e pedido cancelado não editam.
 * Pedido a prazo VENCIDO também não: só o pagamento pode ser registrado (senão daria para reduzir o
 * total, trocar para PIX e o cliente sair da inadimplência pagando menos).
 */
export const podeEditar = (p: PedidoComPrazo & Pick<DadosPedido, 'devolvidoEm'>) =>
  !p.pagoEm && !p.devolvidoEm && !p.canceladoEm && !estaVencido(p);

/**
 * Cancelar (o "excluir" do pedido): mesmas condições da edição (não pago, não devolvido, não vencido).
 * Pedido a prazo vencido não pode ser cancelado: senão o cliente sairia da inadimplência sem pagar.
 */
export const podeCancelar = (p: PedidoComPrazo & Pick<DadosPedido, 'devolvidoEm'>) => podeEditar(p);

/** Só aluguel já concluído e ainda não devolvido pode ser devolvido. */
export const podeDevolver = (p: EstadoPedido & { tipo: TipoPedido }) =>
  p.tipo === 'ALUGUEL' && statusDoPedido(p) === 'CONCLUIDO';
