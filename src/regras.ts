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
  CANCELADO: 'Cancelado',
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
  canceladoEm?: string; // cancelado (o "excluir" do pedido): não volta atrás
  pagoEm?: string;
  clienteInadimplente?: boolean; // inadimplente perde os 5% automáticos de VIP
}

type EstadoPedido = Pick<DadosPedido, 'solicitacao' | 'concluidoEm' | 'devolvidoEm' | 'canceladoEm'>;

type PedidoComPrazo = Pick<DadosPedido, 'pagamento' | 'pagoEm' | 'canceladoEm'> & { clienteId: number; vencimento: string };

/** Pedido a prazo que passou do vencimento sem pagamento (na data `em`, padrão: agora). */
export function estaVencido(p: PedidoComPrazo, em: Date = new Date()): boolean {
  const pagoAte = p.pagoEm != null && new Date(p.pagoEm) <= em;
  return p.pagamento === 'A_PRAZO' && !p.canceladoEm && !pagoAte && new Date(p.vencimento) < em;
}

/** "AAAA-MM-DD" → último instante desse dia (hora local); null se a data for inválida. */
export function fimDoDia(data: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  return d.getDate() === Number(m[3]) ? d : null; // recusa 31/02 etc.
}

/** ISO → "AAAA-MM-DD" na hora local (para o campo de data e para comparar datas). */
export function dataLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Data de hoje em "AAAA-MM-DD" (hora local), para o mínimo do campo de data. */
export function hojeAAAAMMDD(desloc = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + desloc);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Pedido a prazo: o vencimento é obrigatório e precisa ser uma data futura (como o @Future do back). */
export function erroVencimento(data: string | undefined): string | null {
  if (!data) return 'Informe a data de vencimento do pedido a prazo.';
  const fim = fimDoDia(data);
  if (!fim) return 'Data de vencimento inválida.';
  if (data <= hojeAAAAMMDD()) return 'A data de vencimento precisa ser depois de hoje.';
  return null;
}

/** Inadimplente: tem pelo menos um pedido a prazo vencido e não pago. */
export function estaInadimplente(clienteId: number, pedidos: PedidoComPrazo[], em: Date = new Date()): boolean {
  return pedidos.some((p) => p.clienteId === clienteId && estaVencido(p, em));
}

export const MSG_SAIR_DO_A_PRAZO =
  'Pedido a prazo só pode passar para PIX ou à vista se for pago na hora: tire a solicitação de desconto.';

export const MSG_INADIMPLENTE_SEM_DESCONTO =
  'Cliente inadimplente não tem desconto e não pode solicitar desconto (nem com aprovação de colaborador).';

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

const arredondar = (n: number) => Math.round(n * 100) / 100;

export function resumoPedido(p: DadosPedido) {
  const meses = p.meses ?? 1;
  const subtotal = arredondar(
    p.itens.reduce((soma, i) => soma + i.precoUnitario * i.quantidade, 0) * meses,
  );

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

/** Desconto solicitado ainda sem decisão de um colaborador. */
export const aguardaDesconto = (p: Pick<DadosPedido, 'solicitacao'>) => p.solicitacao?.status === 'PENDENTE';

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
 * Aluguel devolvido não edita.
 */
export const podeEditar = (p: Pick<DadosPedido, 'pagoEm' | 'devolvidoEm' | 'canceladoEm'>) =>
  !p.pagoEm && !p.devolvidoEm && !p.canceladoEm;

/**
 * Cancelar (o "excluir" do pedido): só pedido que ainda pode ser editado (não pago, não devolvido).
 * Pedido a prazo vencido não pode ser cancelado: senão o cliente sairia da inadimplência sem pagar.
 */
export const podeCancelar = (p: PedidoComPrazo & Pick<DadosPedido, 'devolvidoEm'>) =>
  podeEditar(p) && !estaVencido(p);

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
