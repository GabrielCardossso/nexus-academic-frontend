/** Produtos nos dados locais, iguais ao ProdutoService do back: cadastrar, listar, editar, repor estoque e excluir. */
import type {
  ProdutoCriarRequest,
  ProdutoCriarResponse,
  ProdutoEditarRequest,
  ProdutoListarResponse,
} from '../../types';
import {
  ativos,
  CHAVE_PEDIDOS,
  CHAVE_PRODUTOS,
  falha,
  ler,
  proximoId,
  salvar,
  substituir,
  type PedidoSalvo,
  type ProdutoSalvo,
} from './armazenamento';

const naoExiste = (id: number): never => falha(`O produto de id : ${id} não existe`);

function validarPreco(valor: number, rotulo: string): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) falha(`${rotulo} inválido.`); // @Min(0) da entidade
  return n;
}

/** POST /produtos. O back não recebe status: o produto novo entra como DISPONIVEL. */
export async function cadastrarProdutoLocal(dados: ProdutoCriarRequest): Promise<ProdutoCriarResponse> {
  const nome = dados.nome.trim();
  if (!nome) falha('Informe o nome do produto.');
  const estoque = Number(dados.estoque);
  if (!Number.isInteger(estoque) || estoque < 0) falha('Estoque inválido.');
  const produtos = ler<ProdutoSalvo>(CHAVE_PRODUTOS);
  const novo: ProdutoSalvo = {
    id: proximoId(produtos),
    nome,
    descricao: dados.descricao.trim(),
    estoque,
    precoVenda: validarPreco(dados.precoVenda, 'Preço de venda'),
    precoAluguel: validarPreco(dados.precoAluguel, 'Preço de aluguel'),
    status: 'DISPONIVEL',
  };
  salvar(CHAVE_PRODUTOS, [...produtos, novo]);
  const { id, descricao, precoVenda, precoAluguel } = novo;
  return { id, nome, descricao, estoque, precoVenda, precoAluguel };
}

/** GET /produtos: só os não excluídos. */
export async function listarProdutosLocal(): Promise<ProdutoListarResponse[]> {
  return ativos(ler<ProdutoSalvo>(CHAVE_PRODUTOS)).map(({ excluido: _, ...p }) => p);
}

/** PUT /produtos/{id}/editar: nome, descrição e preços. Estoque e status não mudam aqui. */
export async function editarProdutoLocal(id: number, dados: ProdutoEditarRequest): Promise<ProdutoSalvo> {
  const produtos = ler<ProdutoSalvo>(CHAVE_PRODUTOS);
  const atual = ativos(produtos).find((p) => p.id === id) ?? naoExiste(id);
  const nome = dados.nome.trim();
  if (!nome) falha('Informe o nome do produto.'); // @NotEmpty
  return substituir(CHAVE_PRODUTOS, produtos, {
    ...atual,
    nome,
    descricao: dados.descricao.trim(),
    precoVenda: validarPreco(dados.precoVenda, 'Preço de venda'),
    precoAluguel: validarPreco(dados.precoAluguel, 'Preço de aluguel'),
  });
}

/** PUT /produtos/adicionarEstoque: soma a quantidade ao estoque (não muda o status). */
export async function reporEstoqueLocal(id: number, quantidade: number): Promise<ProdutoSalvo> {
  const produtos = ler<ProdutoSalvo>(CHAVE_PRODUTOS);
  const atual = ativos(produtos).find((p) => p.id === id) ?? naoExiste(id);
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    falha('É preciso informar uma quantidade maior que 0 para adição de estoque');
  }
  return substituir(CHAVE_PRODUTOS, produtos, { ...atual, estoque: atual.estoque + quantidade });
}

/**
 * DELETE /produtos/{id}: soft delete (o produto some da listagem; o back não tem reativar produto).
 * Não deixa se o produto estiver em pedido pendente ou em aluguel ainda não devolvido.
 */
export async function excluirProdutoLocal(id: number): Promise<ProdutoSalvo> {
  const produtos = ler<ProdutoSalvo>(CHAVE_PRODUTOS);
  const atual = ativos(produtos).find((p) => p.id === id) ?? naoExiste(id);
  const emUso = ativos(ler<PedidoSalvo>(CHAVE_PEDIDOS)).some((p) =>
    p.itens.some(
      (i) => i.produtoId === id && (p.statusPedido === 'PENDENTE' || (i.isAluguel && !i.dataDevolucao)),
    ),
  );
  if (emUso) falha(`O produto de id: ${id} não pode ser excluído pois possui pedidos pendentes ou aluguéis não devolvidos`);
  return substituir(CHAVE_PRODUTOS, produtos, { ...atual, excluido: true });
}
