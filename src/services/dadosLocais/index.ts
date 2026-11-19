/**
 * ============================================================
 *  DADOS LOCAIS — o back-end "de mentira" no localStorage
 * ============================================================
 * Reproduz o back (repo LionT750/Nexus, branch main): mesmas regras, validações e mensagens de erro.
 * Usado com USAR_DADOS_LOCAIS = true em config/api.ts. A diferença é que devolve também os campos
 * que o back não lista: os cadastros desativados (para poder reativar).
 *
 *  - armazenamento.ts  chaves do localStorage, formato das "tabelas" e ajudantes comuns
 *  - validacao.ts      CNPJ e CPF
 *  - clientes.ts, produtos.ts, colaboradores.ts, pedidos.ts, descontos.ts  um serviço por arquivo
 *  - mocks.ts          dados de exemplo (cadastros iguais aos mocks do back)
 */
export * from './clientes';
export * from './produtos';
export * from './colaboradores';
export * from './pedidos';
export * from './descontos';
