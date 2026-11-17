/**
 * ============================================================
 *  CONFIGURAÇÃO DOS ENDPOINTS — É AQUI QUE VOCÊ MEXE
 * ============================================================
 *
 * URL base do back-end: vem do arquivo ".env" (VITE_API_URL).
 * Se não tiver .env, usa http://localhost:8080 (padrão do Spring Boot).
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
 
/**
 * Caminhos dos endpoints, iguais aos do back (repo LionT750/Nexus, branch main).
 * O back usa context-path "/api/v1" (application.yml), por isso o prefixo.
 * Swagger: http://localhost:8080/api/v1/swagger-ui/index.html
 */
const PREFIXO = '/api/v1';

export const ENDPOINTS = {
  // Cadastro (POST) e listagem (GET) usam o mesmo caminho.
  clientes: `${PREFIXO}/clientes`,
  produtos: `${PREFIXO}/produtos`,
  colaboradores: `${PREFIXO}/colaboradores`,
};

/**
 * true  = salva/lê do localStorage do navegador (temporário, sem back-end).
 * false = usa o back-end real (API_BASE_URL + ENDPOINTS acima).
 */
export const USAR_DADOS_LOCAIS = true;

/**
 * true  = na primeira vez (localStorage vazio) carrega clientes, produtos e pedidos de exemplo.
 * Para recomeçar do zero: apague as chaves "nexus:*" no localStorage e recarregue a página.
 */
export const CARREGAR_MOCKS = true;
