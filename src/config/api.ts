/**
 * ============================================================
 *  CONFIGURAÇÃO DOS ENDPOINTS — É AQUI QUE VOCÊ MEXE
 * ============================================================
 *
 * URL base do back-end: vem do arquivo ".env" (VITE_API_URL).
 * Sem VITE_API_URL, as chamadas vão para o próprio endereço do front ("/api/v1/..."), e no
 * "npm run dev" o Vite repassa para o back (proxy em vite.config.ts). Isso contorna o CORS que o
 * back ainda não libera.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? '';

/**
 * Caminhos dos endpoints, iguais aos do back (repo LionT750/Nexus, branch main).
 * O back usa context-path "/api/v1" (application.yml), por isso o prefixo.
 * Swagger: http://localhost:8080/api/v1/swagger-ui/index.html
 */
const PREFIXO = '/api/v1';

export const ENDPOINTS = {
  // Clientes (ClienteRestController)
  clientes: `${PREFIXO}/clientes`, // POST cadastra, GET lista
  cliente: (id: number) => `${PREFIXO}/clientes/${id}`, // DELETE
  clienteEditar: (id: number) => `${PREFIXO}/clientes/${id}/editar`, // PUT
  clienteReativar: (id: number) => `${PREFIXO}/clientes/${id}/reativar`, // PUT

  // Produtos (ProdutoRestController)
  produtos: `${PREFIXO}/produtos`, // POST cadastra, GET lista
  produto: (id: number) => `${PREFIXO}/produtos/${id}`, // DELETE
  produtoEditar: (id: number) => `${PREFIXO}/produtos/${id}/editar`, // PUT
  produtoAdicionarEstoque: `${PREFIXO}/produtos/adicionarEstoque`, // PUT
  produtosAlugados: `${PREFIXO}/produtos/listarAlugados`, // GET

  // Colaboradores (ColaboradorRestController)
  colaboradores: `${PREFIXO}/colaboradores`, // POST cadastra, GET lista
  colaborador: (id: number) => `${PREFIXO}/colaboradores/${id}`, // DELETE
  colaboradorEditar: (id: number) => `${PREFIXO}/colaboradores/${id}/editar`, // PUT
  colaboradorReativar: (id: number) => `${PREFIXO}/colaboradores/${id}/reativar`, // PUT

  // Pedidos (PedidoRestController)
  pedidos: `${PREFIXO}/pedidos`, // POST cria, GET lista
  pedido: (id: number) => `${PREFIXO}/pedidos/${id}`, // GET detalhe, DELETE exclui
  pedidoEditar: (id: number) => `${PREFIXO}/pedidos/${id}/editar`, // PUT
  pedidoDesconto: (id: number) => `${PREFIXO}/pedidos/${id}/desconto`, // PUT (aprovar/reprovar)
  pedidoFinalizar: (id: number) => `${PREFIXO}/pedidos/${id}/finalizar`, // PUT (marca como pago)
  pedidoDevolucao: (id: number) => `${PREFIXO}/pedidos/${id}/devolucao`, // PUT (aluguel)
  pedidosVencidos: `${PREFIXO}/pedidos/vencidosEmAberto`, // GET
  pedidosSolicitacoesDesconto: `${PREFIXO}/pedidos/solicitacoesDescontoEmAberto`, // GET
  pedidosDoCliente: `${PREFIXO}/pedidos/cliente`, // GET ?idCliente= | ?cnpjCliente= | ?emailCliente=
};

/**
 * true  = salva/lê do localStorage do navegador (o "back" de mentira em services/dadosLocais).
 * false = usa o back-end real (API_BASE_URL + ENDPOINTS acima).
 */
export const USAR_DADOS_LOCAIS = true;

/**
 * true  = na primeira vez (localStorage vazio) carrega os dados de exemplo.
 * Para recomeçar do zero: apague as chaves "nexus:*" no localStorage e recarregue a página.
 */
export const CARREGAR_MOCKS = true;
