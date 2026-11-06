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
 * Caminhos dos endpoints.
 * TROQUE pelos caminhos que o back-end criar (veja no Swagger:
 * http://localhost:8080/swagger-ui/index.html).
 */
export const ENDPOINTS = {
  // TODO: coloque aqui o endpoint de CADASTRO DE CLIENTE
  cadastrarCliente: '/api/clientes',
 
  // TODO: coloque aqui o endpoint de CADASTRO DE PRODUTO
  cadastrarProduto: '/api/produtos',
 
  // TODO: endpoints de LISTAGEM (GET). Normalmente é o mesmo caminho do cadastro.
  listarClientes: '/api/clientes',
  listarProdutos: '/api/produtos',
};
 