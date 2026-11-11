/**
 * Regras de negócio de pedido/desconto, em funções puras.
 * Usadas pela tela (prévia do pedido) e pelos dados locais.
 */
import type {
  ClienteCategoria,
  FormaPagamento,
  ItemPedido,
  SolicitacaoDesconto,
  StatusPedido,
} from './types';

export const PRAZO_DIAS = 30; // vencimento do pedido "a prazo"
export const DESCONTO_VIP = 5;

export const ROTULO_PAGAMENTO: Record<FormaPagamento, string> = {
  PIX: 'PIX',
  A_VISTA: 'À vista',
  A_PRAZO: 'A prazo',
};

interface DadosPedido {
  itens: ItemPedido[];
  clienteCategoria: ClienteCategoria;
  pagamento: FormaPagamento;
  solicitacao?: SolicitacaoDesconto;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

export function resumoPedido(p: DadosPedido) {
  const subtotal = arredondar(p.itens.reduce((soma, i) => soma + i.precoUnitario * i.quantidade, 0));

  // VIP: 5% automático. NORMAL: só depois de APROVADA.
  const percentual =
    p.clienteCategoria === 'VIP'
      ? DESCONTO_VIP
      : p.solicitacao?.status === 'APROVADA'
        ? p.solicitacao.percentual
        : 0;

  const valorDesconto = arredondar((subtotal * percentual) / 100);
  const total = arredondar(subtotal - valorDesconto);

  // Pago na hora (PIX/à vista), exceto se ainda aguarda aprovação de desconto.
  const status: StatusPedido =
    p.pagamento === 'A_PRAZO' || p.solicitacao?.status === 'PENDENTE' ? 'PENDENTE' : 'PAGO';

  return { subtotal, percentual, valorDesconto, total, status };
}

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
