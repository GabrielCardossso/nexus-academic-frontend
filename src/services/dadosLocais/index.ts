/**
 * ============================================================
 *  DADOS LOCAIS (temporário) — salva no localStorage do navegador
 * ============================================================
 * Faz o papel do back-end enquanto ele não está integrado (USAR_DADOS_LOCAIS = true em config/api.ts).
 *
 *  - armazenamento.ts  chaves do localStorage, ler/salvar e ajudantes comuns
 *  - validacao.ts      CNPJ e CPF
 *  - clientes.ts, produtos.ts, colaboradores.ts, pedidos.ts, descontos.ts  uma entidade por arquivo
 *  - mocks.ts          dados de exemplo gravados na primeira execução
 */
export * from './clientes';
export * from './produtos';
export * from './colaboradores';
export * from './pedidos';
export * from './descontos';
