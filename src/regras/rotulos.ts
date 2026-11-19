/** Textos que aparecem na tela para cada valor dos enums do back. */
import type { ModalidadePagamento, ProdutoStatus, StatusAprovacaoDesconto, StatusPedido } from '../types';

export const ROTULO_PAGAMENTO: Record<ModalidadePagamento, string> = {
  A_VISTA: 'À vista',
  A_PRAZO: 'A prazo',
};

export const ROTULO_STATUS_PEDIDO: Record<StatusPedido, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  REJEITADO: 'Rejeitado',
};

export const ROTULO_STATUS_DESCONTO: Record<StatusAprovacaoDesconto, string> = {
  NAO_SOLICITADO: 'Sem desconto',
  PENDENTE: 'Desconto aguardando decisão',
  APROVADO: 'Desconto aprovado',
  APROVADO_AUTOMATICAMENTE: 'Desconto VIP automático',
  REPROVADO: 'Desconto reprovado',
  REPROVADO_INADIPLENCIA: 'Reprovado por inadimplência',
};

export const ROTULO_STATUS_PRODUTO: Record<ProdutoStatus, string> = {
  DISPONIVEL: 'Disponível',
  INDISPONIVEL: 'Indisponível',
  DESATIVADO: 'Desativado',
};

/** Classe CSS do selo de cada status (cores em estilos/App.css). */
export const CLASSE_STATUS_DESCONTO: Record<StatusAprovacaoDesconto, string> = {
  NAO_SOLICITADO: 'neutro',
  PENDENTE: 'pendente',
  APROVADO: 'aprovada',
  APROVADO_AUTOMATICAMENTE: 'aprovada',
  REPROVADO: 'rejeitada',
  REPROVADO_INADIPLENCIA: 'rejeitada',
};
