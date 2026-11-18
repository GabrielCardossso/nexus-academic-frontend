/**
 * Regras de negócio em funções puras, separadas por assunto. Usadas pela tela (prévia do pedido)
 * e pelos dados locais (o "back" de mentira). Importe sempre daqui: `import { resumoPedido } from '../regras'`.
 *
 *  - pedido.ts        total, status e o que o pedido pode fazer (confirmar, pagar, editar, cancelar, devolver)
 *  - descontos.ts     desconto automático de VIP, faixas de solicitação e textos da decisão
 *  - inadimplencia.ts pedido vencido e cliente inadimplente
 *  - datas.ts         vencimento e conversões de data
 *  - mensagens.ts     mensagens de regra usadas na tela e nos dados locais
 *  - rotulos.ts       textos de cada valor (pagamento, tipo, status)
 */
export * from './pedido';
export * from './descontos';
export * from './inadimplencia';
export * from './datas';
export * from './mensagens';
export * from './rotulos';
