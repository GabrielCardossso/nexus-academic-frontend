/**
 * Dados de exemplo (mock) para testar a tela sem back-end.
 * São carregados uma única vez, quando o localStorage ainda está vazio (ver dadosLocais.ts).
 *
 * Os pedidos cobrem todos os cenários da tela:
 *  - pendente aguardando aprovação de desconto (botão Confirmar bloqueado)
 *  - pendente com desconto aprovado/rejeitado e pendente de cliente VIP (botão Confirmar liberado)
 *  - concluído (pago e com pagamento pendente a prazo)
 *  - aluguel concluído (pode devolver) e aluguel devolvido
 *  - venda a prazo já paga (crédito devolvido) e pedidos a prazo aguardando pagamento
 *  - cliente VIP inadimplente (venda a prazo vencida e não paga), sem os 5% automáticos
 *  - VIP solicitando desconto de 10% a 15% (aprovado e pendente)
 * Estoque e limite de crédito já nascem coerentes com esses pedidos.
 */
import { PRAZO_DIAS, estaInadimplente, pagoNaHora, resumoPedido } from '../regras';
import type {
  ClienteSalvo,
  FormaPagamento,
  Pedido,
  ProdutoCriarResponse,
  SolicitacaoDesconto,
  TipoPedido,
} from '../types';

/** Monta um CNPJ válido a partir dos 12 primeiros dígitos (calcula os dois verificadores). */
function cnpjDe(base: string): string {
  const digito = (digitos: string, pesos: number[]) => {
    const resto = pesos.reduce((soma, peso, i) => soma + Number(digitos[i]) * peso, 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${d2}`;
}

// Limites de crédito ANTES dos pedidos a prazo (o crédito dos não pagos sai no final de gerarMocks).
const CLIENTES_BASE: ClienteSalvo[] = [
  { id: 1, name: 'Construtora Horizonte Ltda', telefone: '(11) 3456-7890', cnpj: cnpjDe('112223330001'), email: 'compras@horizonte.com.br', categoria: 'VIP', limiteCredito: 50000 },
  { id: 2, name: 'Mercado Bom Preço Ltda', telefone: '(11) 98765-4321', cnpj: cnpjDe('223334440001'), email: 'financeiro@bompreco.com.br', categoria: 'NORMAL', limiteCredito: 15000 },
  { id: 3, name: 'Clínica Vida Plena', telefone: '(21) 2233-4455', cnpj: cnpjDe('334445550001'), email: 'adm@vidaplena.com.br', categoria: 'NORMAL', limiteCredito: 8000 },
  { id: 4, name: 'Tech Solutions Informática', telefone: '(31) 99888-7766', cnpj: cnpjDe('445556660001'), email: 'contato@techsolutions.com.br', categoria: 'VIP', limiteCredito: 30000 },
  { id: 5, name: 'Padaria Pão Quente', telefone: '(41) 3322-1100', cnpj: cnpjDe('556667770001'), email: 'padaria@paoquente.com.br', categoria: 'NORMAL', limiteCredito: 3000 },
  { id: 6, name: 'Oficina Mecânica Rápido', telefone: '(51) 99777-6655', cnpj: cnpjDe('667778880001'), email: 'oficina@rapidomecanica.com.br', categoria: 'NORMAL', limiteCredito: 6000 },
];

// Estoque ANTES dos pedidos (a baixa é aplicada no final de gerarMocks).
const PRODUTOS_BASE: ProdutoCriarResponse[] = [
  { id: 1, nome: 'Notebook Dell Latitude 5440', descricao: 'Core i5, 16 GB RAM, SSD 512 GB', estoque: 25, precoVenda: 4890, precoAluguel: 320, status: 'DISPONIVEL' },
  { id: 2, nome: 'Monitor LG 27" 4K', descricao: 'IPS, HDMI e DisplayPort', estoque: 40, precoVenda: 1890, precoAluguel: 140, status: 'DISPONIVEL' },
  { id: 3, nome: 'Impressora Multifuncional HP', descricao: 'Laser, Wi-Fi, duplex', estoque: 15, precoVenda: 1250, precoAluguel: 95, status: 'DISPONIVEL' },
  { id: 4, nome: 'Cadeira Ergonômica Pro', descricao: 'Encosto em tela, ajuste lombar', estoque: 30, precoVenda: 980, precoAluguel: 60, status: 'DISPONIVEL' },
  { id: 5, nome: 'Projetor Epson Full HD', descricao: '3.600 lumens, HDMI', estoque: 8, precoVenda: 3200, precoAluguel: 210, status: 'DISPONIVEL' },
  { id: 6, nome: 'Roteador Wi-Fi 6 TP-Link', descricao: 'Dual band AX3000', estoque: 50, precoVenda: 450, precoAluguel: 35, status: 'DISPONIVEL' },
  { id: 7, nome: 'Servidor Dell PowerEdge T150', descricao: 'Xeon, 32 GB RAM, 2× 1 TB', estoque: 3, precoVenda: 18500, precoAluguel: 1200, status: 'DISPONIVEL' },
  { id: 8, nome: 'Nobreak 1500 VA', descricao: 'Senoidal, bivolt', estoque: 0, precoVenda: 1100, precoAluguel: 80, status: 'INDISPONIVEL' },
  { id: 9, nome: 'Tablet Samsung Tab A7 (linha antiga)', descricao: 'Fora de linha', estoque: 12, precoVenda: 1300, precoAluguel: 70, status: 'DESATIVADO' },
];

interface PedidoMock {
  tipo: TipoPedido;
  clienteId: number;
  pagamento: FormaPagamento;
  itens: Record<number, number>; // produtoId -> quantidade
  meses?: number;
  solicitacao?: SolicitacaoDesconto;
  diasAtras: number;
  concluido?: boolean;
  devolvidoHaDias?: number;
  pagoHaDias?: number; // só a prazo: pagamento registrado
}

const ANA = { colaboradorId: 1, colaboradorNome: 'Ana Souza' };
const CARLOS = { colaboradorId: 2, colaboradorNome: 'Carlos Lima' };

// Do mais antigo para o mais novo (a tela lista os mais recentes primeiro).
const PEDIDOS_MOCK: PedidoMock[] = [
  // Venda a prazo concluída e já paga: o crédito voltou ao limite.
  { tipo: 'VENDA', clienteId: 5, pagamento: 'A_PRAZO', itens: { 6: 3 }, diasAtras: 50, concluido: true, pagoHaDias: 22 },
  // Venda a prazo VENCIDA e não paga: deixa a Tech Solutions (VIP) inadimplente.
  // Ela perde os 5% automáticos nos pedidos não pagos e não pode fazer pedido a prazo.
  { tipo: 'VENDA', clienteId: 4, pagamento: 'A_PRAZO', itens: { 3: 2 }, diasAtras: 45, concluido: true },
  // Aluguel concluído e em andamento: dá para testar a devolução.
  { tipo: 'ALUGUEL', clienteId: 4, pagamento: 'A_VISTA', itens: { 5: 1 }, meses: 3, diasAtras: 40, concluido: true },
  // Aluguel já devolvido.
  { tipo: 'ALUGUEL', clienteId: 3, pagamento: 'PIX', itens: { 2: 2 }, meses: 2, diasAtras: 30, concluido: true, devolvidoHaDias: 6 },
  // Aluguel a prazo concluído (pagamento pendente) de cliente VIP.
  { tipo: 'ALUGUEL', clienteId: 4, pagamento: 'A_PRAZO', itens: { 1: 4 }, meses: 6, diasAtras: 25, concluido: true },
  // Venda a prazo concluída: pedido concluído, pagamento pendente.
  { tipo: 'VENDA', clienteId: 2, pagamento: 'A_PRAZO', itens: { 4: 6, 6: 4 }, diasAtras: 20, concluido: true },
  // Venda VIP concluída e paga.
  { tipo: 'VENDA', clienteId: 1, pagamento: 'PIX', itens: { 1: 3, 2: 3 }, diasAtras: 12, concluido: true },
  // VIP com solicitação de 15% aprovada: substitui os 5% automáticos (não soma).
  { tipo: 'VENDA', clienteId: 1, pagamento: 'PIX', itens: { 4: 10 }, solicitacao: { percentual: 15, status: 'APROVADA', ...CARLOS }, diasAtras: 4 },
  // Desconto rejeitado: pode confirmar, sem desconto.
  { tipo: 'VENDA', clienteId: 6, pagamento: 'A_PRAZO', itens: { 3: 1, 4: 2 }, solicitacao: { percentual: 10, status: 'REJEITADA', ...CARLOS }, diasAtras: 3 },
  // Desconto aprovado: pedido segue pendente até alguém confirmar.
  { tipo: 'VENDA', clienteId: 3, pagamento: 'A_VISTA', itens: { 1: 2 }, solicitacao: { percentual: 7, status: 'APROVADA', ...ANA }, diasAtras: 2 },
  // Desconto aguardando aprovação: confirmação bloqueada.
  { tipo: 'VENDA', clienteId: 5, pagamento: 'PIX', itens: { 3: 2 }, solicitacao: { percentual: 10, status: 'PENDENTE' }, diasAtras: 1 },
  // Cliente VIP: 5% automático, mas o pedido só conclui quando confirmado.
  { tipo: 'VENDA', clienteId: 1, pagamento: 'PIX', itens: { 7: 1 }, diasAtras: 1 },
  // Aluguel a prazo aguardando aprovação de desconto.
  { tipo: 'ALUGUEL', clienteId: 6, pagamento: 'A_PRAZO', itens: { 2: 1 }, meses: 4, solicitacao: { percentual: 5, status: 'PENDENTE' }, diasAtras: 0 },
  // VIP em dia pedindo 12% (fica com os 5% até a decisão).
  { tipo: 'VENDA', clienteId: 1, pagamento: 'A_VISTA', itens: { 2: 5 }, solicitacao: { percentual: 12, status: 'PENDENTE' }, diasAtras: 0 },
  // VIP inadimplente: sem os 5% automáticos, pede 3% (faixa de 1% a 15%, só com aprovação).
  { tipo: 'VENDA', clienteId: 4, pagamento: 'PIX', itens: { 6: 2 }, solicitacao: { percentual: 3, status: 'PENDENTE' }, diasAtras: 0 },
];

const DIA = 24 * 60 * 60 * 1000;

export function gerarMocks() {
  const agora = Date.now();

  const clientes = CLIENTES_BASE.map((c) => ({ ...c }));
  const produtos = PRODUTOS_BASE.map((p) => ({ ...p }));

  const pedidos: Pedido[] = [];
  PEDIDOS_MOCK.forEach((m, i) => {
    const cliente = clientes.find((c) => c.id === m.clienteId)!;
    const emissao = new Date(agora - m.diasAtras * DIA);
    const vencimento = new Date(emissao);
    if (m.meses) vencimento.setMonth(vencimento.getMonth() + m.meses);
    else if (m.pagamento === 'A_PRAZO') vencimento.setDate(vencimento.getDate() + PRAZO_DIAS);

    const aluguel = m.tipo === 'ALUGUEL';
    const pedido: Pedido = {
      id: i + 1,
      tipo: m.tipo,
      clienteId: cliente.id,
      clienteNome: cliente.name,
      clienteCategoria: cliente.categoria,
      itens: Object.entries(m.itens).map(([id, quantidade]) => {
        const produto = produtos.find((p) => p.id === Number(id))!;
        return {
          produtoId: produto.id,
          nome: produto.nome,
          precoUnitario: aluguel ? produto.precoAluguel : produto.precoVenda,
          quantidade,
        };
      }),
      meses: m.meses,
      pagamento: m.pagamento,
      solicitacao: m.solicitacao,
      criadoEm: emissao.toISOString(),
      emissao: emissao.toISOString(),
      vencimento: vencimento.toISOString(),
      concluidoEm: m.concluido ? new Date(emissao.getTime() + 60 * 60 * 1000).toISOString() : undefined,
      devolvidoEm: m.devolvidoHaDias != null ? new Date(agora - m.devolvidoHaDias * DIA).toISOString() : undefined,
      pagoEm: pagoNaHora(m)
        ? emissao.toISOString()
        : m.pagoHaDias != null
          ? new Date(agora - m.pagoHaDias * DIA).toISOString()
          : undefined,
      // Situação do cliente na data do pedido (os anteriores podem ter vencido sem pagamento).
      clienteInadimplente: estaInadimplente(cliente.id, pedidos, emissao),
    };

    // Mesmas regras de criarPedidoLocal: baixa de estoque (volta se devolvido) e crédito usado a prazo.
    if (!pedido.devolvidoEm) {
      for (const item of pedido.itens) {
        produtos.find((p) => p.id === item.produtoId)!.estoque -= item.quantidade;
      }
    }
    // Crédito a prazo: fica reservado até o pagamento (se já foi pago, voltou ao limite).
    if (pedido.pagamento === 'A_PRAZO') {
      pedido.creditoUsado = resumoPedido(pedido).total;
      if (!pedido.pagoEm) {
        cliente.limiteCredito = Math.round((cliente.limiteCredito - pedido.creditoUsado) * 100) / 100;
      }
    }
    // Pago depois da emissão: grava a situação do cliente no dia do pagamento.
    if (pedido.pagoEm && pedido.pagoEm !== pedido.emissao) {
      pedido.clienteInadimplente = estaInadimplente(cliente.id, [...pedidos, pedido], new Date(pedido.pagoEm));
    }
    pedidos.push(pedido);
  });

  return { clientes, produtos, pedidos };
}
