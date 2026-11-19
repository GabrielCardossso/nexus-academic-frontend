/**
 * Regras de negócio em funções puras, iguais às do back (PedidoService etc.). Usadas pela tela
 * (prévia do pedido) e pelos dados locais (o "back" de mentira). Importe sempre daqui:
 * `import { podeFinalizar } from '../regras'`.
 *
 *  - pedido.ts        valor dos itens, total e o que o pedido pode fazer (finalizar, editar, excluir, devolver)
 *  - descontos.ts     desconto na criação, na edição e na decisão do colaborador
 *  - inadimplencia.ts pedido vencido e cliente inadimplente
 *  - datas.ts         datas no formato do back (AAAA-MM-DD) e o @Future
 *  - mensagens.ts     mensagens de regra (inclui as travas que só o front tem)
 *  - rotulos.ts       textos de cada valor dos enums
 */
export * from './pedido';
export * from './descontos';
export * from './inadimplencia';
export * from './datas';
export * from './mensagens';
export * from './rotulos';
