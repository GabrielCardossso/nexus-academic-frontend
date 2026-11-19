/** Mensagens de regra usadas tanto na tela quanto nos dados locais (o "back" de mentira). */

/** Texto do ClienteInadimplenteNaoPodeAbrirPrazoException do back. */
export const MSG_INADIMPLENTE_SEM_PRAZO =
  'O cliente tem pendencias em aberto. Portanto, o pedido não pode ser gerado. Somente pedidos a vista ou pix são aceitos';

export const MSG_INADIMPLENTE_SEM_DESCONTO =
  'Cliente inadimplente: o pedido é registrado como "reprovado por inadimplência" e fica sem desconto nenhum.';

/**
 * Travas que o front mantém e o back ainda não tem (ver README > "Travas do front").
 * Aguardando o Lucas confirmar se viram regra no back ou se saem do front.
 */
export const MSG_VENCIDO_SO_FINALIZAR =
  'Pedido vencido não pode ser editado nem excluído: finalize (registre o pagamento) para o cliente sair da inadimplência.';

export const MSG_INADIMPLENTE_NAO_APROVA =
  'O cliente ficou inadimplente depois de pedir o desconto: a solicitação só pode ser reprovada.';

export const MSG_INADIMPLENTE_NAO_AUMENTA =
  'Cliente inadimplente: o pedido a prazo pode ser editado, mas o total não pode aumentar.';

export const MSG_PRODUTO_INDISPONIVEL = 'Produto indisponível não entra em pedido.';
