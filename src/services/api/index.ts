/**
 * O que as telas chamam para ler e salvar dados. Cada função decide entre o back real e os dados
 * locais (USAR_DADOS_LOCAIS em config/api.ts). Importe sempre daqui: `import { listarClientes } from '../services/api'`.
 *
 *  - http.ts   GET/POST/PUT/DELETE, erro do Spring (ProblemDetail) e a trava do id provisório
 *  - clientes.ts, produtos.ts, colaboradores.ts, pedidos.ts  uma entidade por arquivo, com os DTOs do back
 */
export * from './clientes';
export * from './produtos';
export * from './colaboradores';
export * from './pedidos';
