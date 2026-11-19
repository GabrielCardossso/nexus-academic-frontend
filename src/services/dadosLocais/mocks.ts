/**
 * Dados de exemplo (mock) para testar a tela sem back-end, carregados uma única vez quando o
 * localStorage está vazio (ver armazenamento.ts).
 *
 * Clientes, colaboradores e produtos são os MESMOS do back (entity/mock/*.java), com os mesmos ids
 * (ordem de inserção). O back não tem pedidos de exemplo; os daqui cobrem os cenários da tela:
 *  1. VIP à vista com os 5% automáticos (pode finalizar)
 *  2. VIP a prazo pedindo 12% (aguardando decisão: não finaliza; limite reservado sem desconto)
 *  3. NORMAL à vista pedindo 8% (aguardando decisão)
 *  4. NORMAL a prazo, aluguel com 5% aprovado por colaborador
 *  5. NORMAL a prazo VENCIDO e não pago → cliente inadimplente (só pode finalizar)
 *  6. o mesmo cliente comprando à vista depois: reprovado por inadimplência, sem desconto
 *  7. VIP a prazo já pago, com aluguel já devolvido
 *  8. VIP com aluguel pago e ainda não devolvido (pode devolver)
 *  9. NORMAL pago com desconto de 10% reprovado
 * 10. VIP pedindo 15% aprovado, pendente
 * Estoque e limite de crédito já nascem coerentes com esses pedidos.
 */
import { hojeAAAAMMDD, subtotalDe, totalComDesconto, valorItem } from '../../regras';
import type { ClienteSalvo, ModalidadePagamento, StatusAprovacaoDesconto, StatusPedido } from '../../types';
import { arredondar } from '../../utils';
import type { ColaboradorSalvo, ItemSalvo, PedidoSalvo, ProdutoSalvo } from './armazenamento';

const dia = hojeAAAAMMDD; // dia(-5) = 5 dias atrás, dia(10) = daqui a 10 dias

/** entity/mock/ClienteMock.java */
const CLIENTES: ClienteSalvo[] = [
  { id: 1, name: 'Construtora Horizonte Ltda', cnpj: '88447294000145', telefone: '(48) 3622-1001', email: 'compras@horizonte.com.br', limiteCredito: 50000, categoria: 'VIP' },
  { id: 2, name: 'Engenharia Sul Obras SA', cnpj: '05576169000108', telefone: '(48) 3622-2002', email: 'financeiro@sulobras.com.br', limiteCredito: 20000, categoria: 'VIP' },
  { id: 3, name: 'Reformas Silva ME', cnpj: '87168976000156', telefone: '(48) 99911-3003', email: 'contato@reformassilva.com.br', limiteCredito: 8000, categoria: 'NORMAL' },
  { id: 4, name: 'Mercado Bom Preco Ltda', cnpj: '84697880000197', telefone: '(48) 99922-4004', email: 'adm@bompreco.com.br', limiteCredito: 1500, categoria: 'NORMAL' },
  { id: 5, name: 'Oficina do Ze Mecanica', cnpj: '93208196000195', telefone: '(48) 99933-5005', email: 'ze@oficinadoze.com.br', limiteCredito: 0, categoria: 'NORMAL' },
  { id: 6, name: 'Locadora Tubarao Eventos', cnpj: '72731778000181', telefone: '(48) 3622-6006', email: 'eventos@locadoratubarao.com.br', limiteCredito: 0, categoria: 'VIP' },
];

/** entity/mock/ColaboradorMock.java */
const COLABORADORES: ColaboradorSalvo[] = [
  { id: 1, nome: 'Marcos Antunes', cpf: '15881399803', email: 'marcos.antunes@nexus.com' },
  { id: 2, nome: 'Juliana Prado', cpf: '69879730917', email: 'juliana.prado@nexus.com' },
  { id: 3, nome: 'Rafael Menezes', cpf: '11417075350', email: 'rafael.menezes@nexus.com' },
  { id: 4, nome: 'Camila Duarte', cpf: '64556815177', email: 'camila.duarte@nexus.com' },
];

/** entity/mock/ProdutoMock.java (o 10 está DESATIVADO no status, mas não excluído: aparece na lista). */
const PRODUTOS: ProdutoSalvo[] = [
  { id: 1, nome: 'Furadeira de Impacto 650W', descricao: 'Furadeira profissional com maleta', estoque: 25, precoVenda: 389.9, precoAluguel: 45, status: 'DISPONIVEL' },
  { id: 2, nome: 'Andaime Tubular 1,5m', descricao: 'Modulo de andaime galvanizado', estoque: 60, precoVenda: 720, precoAluguel: 35, status: 'DISPONIVEL' },
  { id: 3, nome: 'Betoneira 400L', descricao: 'Betoneira motor eletrico 2CV', estoque: 8, precoVenda: 3250, precoAluguel: 180, status: 'DISPONIVEL' },
  { id: 4, nome: 'Serra Circular 7 1/4', descricao: 'Serra circular 1800W', estoque: 15, precoVenda: 529.9, precoAluguel: 60, status: 'DISPONIVEL' },
  { id: 5, nome: 'Compactador de Solo', descricao: 'Compactador a gasolina 5,5HP', estoque: 4, precoVenda: 5890, precoAluguel: 320, status: 'DISPONIVEL' },
  { id: 6, nome: 'Gerador 5kVA', descricao: 'Gerador diesel monofasico', estoque: 3, precoVenda: 8900, precoAluguel: 450, status: 'DISPONIVEL' },
  { id: 7, nome: 'Lavadora de Alta Pressao', descricao: 'Lavadora 2200 PSI', estoque: 12, precoVenda: 1190, precoAluguel: 90, status: 'DISPONIVEL' },
  { id: 8, nome: 'Martelete Rompedor 10kg', descricao: 'Martelete SDS Max', estoque: 0, precoVenda: 2780, precoAluguel: 210, status: 'INDISPONIVEL' },
  { id: 9, nome: 'Escada Extensivel 7m', descricao: 'Escada de aluminio', estoque: 1, precoVenda: 950, precoAluguel: 55, status: 'DISPONIVEL' },
  { id: 10, nome: 'Talhadeira Manual (linha antiga)', descricao: 'Descontinuada', estoque: 2, precoVenda: 49.9, precoAluguel: 5, status: 'DESATIVADO' },
];

interface ItemMock {
  produtoId: number;
  quantidade: number;
  aluguelAte?: number; // dias a partir de hoje (aluguel)
  devolvidoHa?: number; // dias atrás (aluguel já devolvido)
}

interface PedidoMock {
  clienteId: number;
  criadoHa: number; // dias atrás
  modalidade: ModalidadePagamento;
  venceEm?: number; // dias a partir de hoje (negativo = já venceu)
  itens: ItemMock[];
  solicitado: number;
  autorizado: number;
  statusDesconto: StatusAprovacaoDesconto;
  colaboradorId?: number;
  status: StatusPedido;
  descricao?: string;
}

const PEDIDOS: PedidoMock[] = [
  { clienteId: 1, criadoHa: 1, modalidade: 'A_VISTA', itens: [{ produtoId: 1, quantidade: 2 }, { produtoId: 4, quantidade: 1 }], solicitado: 0, autorizado: 0.05, statusDesconto: 'APROVADO_AUTOMATICAMENTE', status: 'PENDENTE', descricao: 'Ferramentas para a obra do centro' },
  { clienteId: 2, criadoHa: 2, modalidade: 'A_PRAZO', venceEm: 25, itens: [{ produtoId: 2, quantidade: 10 }], solicitado: 0.12, autorizado: 0, statusDesconto: 'PENDENTE', status: 'PENDENTE' },
  { clienteId: 3, criadoHa: 1, modalidade: 'A_VISTA', itens: [{ produtoId: 7, quantidade: 1 }], solicitado: 0.08, autorizado: 0, statusDesconto: 'PENDENTE', status: 'PENDENTE' },
  { clienteId: 3, criadoHa: 5, modalidade: 'A_PRAZO', venceEm: 20, itens: [{ produtoId: 3, quantidade: 2, aluguelAte: 15 }], solicitado: 0.05, autorizado: 0.05, statusDesconto: 'APROVADO', colaboradorId: 1, status: 'PENDENTE', descricao: 'Aluguel das betoneiras da reforma' },
  { clienteId: 4, criadoHa: 40, modalidade: 'A_PRAZO', venceEm: -5, itens: [{ produtoId: 7, quantidade: 1 }], solicitado: 0, autorizado: 0, statusDesconto: 'NAO_SOLICITADO', status: 'PENDENTE' },
  { clienteId: 4, criadoHa: 2, modalidade: 'A_VISTA', itens: [{ produtoId: 1, quantidade: 1 }], solicitado: 0.05, autorizado: 0, statusDesconto: 'REPROVADO_INADIPLENCIA', status: 'PENDENTE' },
  { clienteId: 1, criadoHa: 30, modalidade: 'A_PRAZO', venceEm: -1, itens: [{ produtoId: 5, quantidade: 1, aluguelAte: -10, devolvidoHa: 12 }, { produtoId: 2, quantidade: 4 }], solicitado: 0, autorizado: 0.05, statusDesconto: 'APROVADO_AUTOMATICAMENTE', status: 'PAGO' },
  { clienteId: 2, criadoHa: 7, modalidade: 'A_VISTA', itens: [{ produtoId: 6, quantidade: 1, aluguelAte: 7 }], solicitado: 0, autorizado: 0.05, statusDesconto: 'APROVADO_AUTOMATICAMENTE', status: 'PAGO' },
  { clienteId: 5, criadoHa: 10, modalidade: 'A_VISTA', itens: [{ produtoId: 9, quantidade: 1 }], solicitado: 0.1, autorizado: 0, statusDesconto: 'REPROVADO', colaboradorId: 2, status: 'PAGO' },
  { clienteId: 6, criadoHa: 0, modalidade: 'A_VISTA', itens: [{ produtoId: 4, quantidade: 2, aluguelAte: 30 }], solicitado: 0.15, autorizado: 0.15, statusDesconto: 'APROVADO', colaboradorId: 3, status: 'PENDENTE', descricao: 'Evento de fim de ano' },
];

/** Só os cadastros, como o back sobe (sem pedidos). Usado para comparar o front com o back. */
export function cadastrosDoBack() {
  return {
    clientes: CLIENTES.map((c) => ({ ...c })),
    produtos: PRODUTOS.map((p) => ({ ...p })),
    colaboradores: COLABORADORES.map((c) => ({ ...c })),
  };
}

export function gerarMocks() {
  const clientes = CLIENTES.map((c) => ({ ...c }));
  const produtos = PRODUTOS.map((p) => ({ ...p }));

  const pedidos: PedidoSalvo[] = PEDIDOS.map((m, i) => {
    const itens: ItemSalvo[] = m.itens.map((it) => {
      const produto = produtos.find((p) => p.id === it.produtoId)!;
      const isAluguel = it.aluguelAte !== undefined;
      const devolvido = it.devolvidoHa !== undefined;
      if (!devolvido) produto.estoque -= it.quantidade; // o que está com o cliente sai do estoque
      return {
        produtoId: it.produtoId,
        quantidade: it.quantidade,
        valorItem: valorItem(produto, it.quantidade, isAluguel),
        isAluguel,
        dataVencimentoAluguel: isAluguel ? dia(it.aluguelAte!) : null,
        dataDevolucao: devolvido ? dia(-it.devolvidoHa!) : null,
      };
    });
    const valorTotal = totalComDesconto(subtotalDe(itens), m.autorizado);
    // A prazo ainda não pago segura o total no limite do cliente.
    if (m.modalidade === 'A_PRAZO' && m.status === 'PENDENTE') {
      const cliente = clientes.find((c) => c.id === m.clienteId)!;
      cliente.limiteCredito = arredondar(cliente.limiteCredito - valorTotal);
    }
    const decidido = m.statusDesconto !== 'NAO_SOLICITADO' && m.statusDesconto !== 'PENDENTE';
    return {
      id: i + 1,
      descricao: m.descricao ?? null,
      valorTotal,
      dataCriacao: dia(-m.criadoHa),
      dataVencimento: m.venceEm !== undefined ? dia(m.venceEm) : null,
      dataAtualizacaoDesconto: decidido && m.statusDesconto !== 'REPROVADO_INADIPLENCIA' ? dia(-m.criadoHa) : null,
      descontoSolicitado: m.solicitado,
      descontoAutorizado: m.autorizado,
      statusPedido: m.status,
      statusAprovacaoDesconto: m.statusDesconto,
      modalidadePagamento: m.modalidade,
      clienteId: m.clienteId,
      colaboradorDescontoId: m.colaboradorId ?? null,
      itens,
    };
  });

  return { clientes, produtos, colaboradores: COLABORADORES.map((c) => ({ ...c })), pedidos };
}
