import { useEffect, useState, type FormEvent } from 'react';
import { criarPedido, devolverPedido, listarClientes, listarPedidos, listarProdutos } from '../services/api';
import { linhasSolicitacao, resumoPedido, ROTULO_PAGAMENTO, ROTULO_TIPO, PRAZO_DIAS } from '../regras';
import type {
  ClienteListarResponse,
  FormaPagamento,
  ItemPedido,
  Pedido,
  ProdutoListarResponse,
  SolicitacaoDesconto,
  TipoPedido,
} from '../types';
import { dataBR, dataHoraBR, moeda, type Mensagem } from '../utils';

function linhasPedido(p: Pedido): string[] {
  const r = resumoPedido(p);
  const aluguel = p.tipo === 'ALUGUEL';
  return [
    `Tipo: ${ROTULO_TIPO[p.tipo]}${aluguel ? ` (${p.meses} ${p.meses === 1 ? 'mês' : 'meses'})` : ''}`,
    `Cliente: ${p.clienteNome} (${p.clienteCategoria})`,
    `Itens: ${p.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(', ')}`,
    `Pagamento: ${ROTULO_PAGAMENTO[p.pagamento]}`,
    `Subtotal: ${moeda.format(r.subtotal)}`,
    `Desconto aplicado: ${r.percentual}% (− ${moeda.format(r.valorDesconto)})`,
    `Total: ${moeda.format(r.total)}`,
    `Status do pedido: ${r.status}`,
    ...(p.solicitacao ? linhasSolicitacao(p.solicitacao) : []),
    ...(p.pagamento === 'A_PRAZO' ? [`Crédito utilizado: ${moeda.format(r.total)}`] : []),
    `Criado em ${dataHoraBR(p.criadoEm)}`,
    aluguel
      ? `Início: ${dataBR(p.emissao)} · Fim do aluguel: ${dataBR(p.vencimento)}`
      : `Emissão: ${dataBR(p.emissao)} · Vencimento: ${dataBR(p.vencimento)}`,
    ...(p.devolvidoEm ? [`Devolvido em ${dataHoraBR(p.devolvidoEm)}`] : []),
  ];
}

export default function PedidosTela() {
  const [clientes, setClientes] = useState<ClienteListarResponse[]>([]);
  const [produtos, setProdutos] = useState<ProdutoListarResponse[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const [tipo, setTipo] = useState<TipoPedido>('VENDA');
  const [clienteId, setClienteId] = useState('');
  const [quantidades, setQuantidades] = useState<Record<number, string>>({});
  const [meses, setMeses] = useState('1'); // só aluguel
  const [pagamento, setPagamento] = useState<FormaPagamento>('PIX');
  const [descontoSolicitado, setDescontoSolicitado] = useState(''); // '' | '5' | '10'
  const [msg, setMsg] = useState<Mensagem>(null);
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    try {
      const [c, p, ped] = await Promise.all([listarClientes(), listarProdutos(), listarPedidos()]);
      setClientes(c);
      setProdutos(p);
      setPedidos(ped);
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // ---------- Prévia do pedido ----------
  const aluguel = tipo === 'ALUGUEL';
  const quantidadeMeses = Number(meses);
  const cliente = clientes.find((c) => String(c.id) === clienteId);
  const disponiveis = produtos.filter((p) => p.status === 'DISPONIVEL' && p.estoque > 0);
  const precoDe = (p: ProdutoListarResponse) => Number(aluguel ? p.precoAluguel : p.precoVenda);

  const itens: ItemPedido[] = disponiveis.flatMap((p) => {
    const quantidade = Number(quantidades[p.id]);
    return quantidade > 0
      ? [{ produtoId: p.id, nome: p.nome, precoUnitario: precoDe(p), quantidade }]
      : [];
  });

  const solicitacao: SolicitacaoDesconto | undefined =
    cliente?.categoria === 'NORMAL' && descontoSolicitado
      ? { percentual: Number(descontoSolicitado) as 5 | 10, status: 'PENDENTE' }
      : undefined;

  const resumo = resumoPedido({
    itens,
    clienteCategoria: cliente?.categoria ?? 'NORMAL',
    pagamento,
    meses: aluguel ? quantidadeMeses : undefined,
    solicitacao,
  });
  const acimaDoLimite = !!cliente && pagamento === 'A_PRAZO' && resumo.total > cliente.limiteCredito;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!cliente) return setMsg({ tipo: 'erro', texto: 'Selecione um cliente.' });
    if (itens.length === 0) {
      return setMsg({ tipo: 'erro', texto: 'Informe a quantidade de pelo menos um produto.' });
    }
    if (aluguel && (!Number.isInteger(quantidadeMeses) || quantidadeMeses <= 0)) {
      return setMsg({ tipo: 'erro', texto: 'Informe a duração do aluguel em meses.' });
    }

    setEnviando(true);
    try {
      const pedido = await criarPedido({
        tipo,
        clienteId: cliente.id,
        pagamento,
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
        meses: aluguel ? quantidadeMeses : undefined,
        descontoSolicitado: solicitacao?.percentual,
      });
      setMsg({ tipo: 'sucesso', texto: `Pedido #${pedido.id} realizado!` });
      setQuantidades({});
      setMeses('1');
      setDescontoSolicitado('');
      await carregar(); // estoque e crédito mudaram e o pedido novo entra na lista
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  async function devolver(pedidoId: number) {
    setMsg(null);
    try {
      await devolverPedido(pedidoId);
      setMsg({ tipo: 'sucesso', texto: `Aluguel #${pedidoId} devolvido. Estoque atualizado.` });
      await carregar();
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    }
  }

  return (
    <>
      <h1>Pedidos</h1>
      <div className="tela">
        <form className="card" onSubmit={handleSubmit}>
          <h2>Novo pedido</h2>

          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPedido)}>
            <option value="VENDA">Venda</option>
            <option value="ALUGUEL">Aluguel</option>
          </select>

          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
            <option value="">Selecione o cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.categoria})
              </option>
            ))}
          </select>
          {clientes.length === 0 && <p className="dica">Nenhum cliente cadastrado ainda.</p>}

          {cliente && (
            <>
              <p className="dica">Limite de crédito do cliente: {moeda.format(cliente.limiteCredito)}</p>
              {cliente.categoria === 'VIP' ? (
                <p className="dica">Cliente VIP: 5% de desconto automático em qualquer forma de pagamento.</p>
              ) : (
                <select value={descontoSolicitado} onChange={(e) => setDescontoSolicitado(e.target.value)}>
                  <option value="">Sem solicitação de desconto</option>
                  <option value="5">Solicitar desconto de 5%</option>
                  <option value="10">Solicitar desconto de 10%</option>
                </select>
              )}
            </>
          )}

          <strong>Produtos</strong>
          {disponiveis.length === 0 && <p className="vazio">Nenhum produto disponível com estoque.</p>}
          {disponiveis.map((p) => (
            <label key={p.id} className="linha-produto">
              <span>
                {p.nome} — {moeda.format(precoDe(p))}
                {aluguel && ' por mês'}
                <br />
                <small>Estoque: {p.estoque}</small>
              </span>
              <input
                type="number"
                placeholder="Qtd."
                min={0}
                max={p.estoque}
                step={1}
                value={quantidades[p.id] ?? ''}
                onChange={(e) => setQuantidades((q) => ({ ...q, [p.id]: e.target.value }))}
              />
            </label>
          ))}

          {aluguel && (
            <>
              <input
                type="number"
                placeholder="Duração do aluguel (meses)"
                min={1}
                step={1}
                value={meses}
                onChange={(e) => setMeses(e.target.value)}
                required
              />
              <p className="dica">Valor do aluguel: preço por mês × meses × quantidade.</p>
            </>
          )}

          <select value={pagamento} onChange={(e) => setPagamento(e.target.value as FormaPagamento)}>
            <option value="PIX">PIX</option>
            <option value="A_VISTA">À vista</option>
            <option value="A_PRAZO">{aluguel ? 'A prazo' : `A prazo (${PRAZO_DIAS} dias)`}</option>
          </select>

          <div className="resumo">
            <span>Subtotal: {moeda.format(resumo.subtotal)}</span>
            <span>
              Desconto: {resumo.percentual}% (− {moeda.format(resumo.valorDesconto)})
            </span>
            <strong>Total: {moeda.format(resumo.total)}</strong>
            <span>Status do pedido: {resumo.status}</span>
          </div>
          {solicitacao && (
            <p className="dica">O desconto solicitado só é aplicado depois da aprovação de um colaborador.</p>
          )}
          {pagamento === 'A_PRAZO' && <p className="dica">O total será descontado do limite de crédito do cliente.</p>}
          {acimaDoLimite && <p className="msg erro">Total acima do limite de crédito do cliente.</p>}

          {msg && <p className={`msg ${msg.tipo}`}>{msg.texto}</p>}
          <button type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Fazer pedido'}
          </button>
        </form>

        <section className="card">
          <h2>Pedidos realizados</h2>
          {pedidos.length === 0 && <p className="vazio">Nenhum pedido ainda.</p>}
          {pedidos.length > 0 && (
            <ul className="lista alta">
              {pedidos.map((p) => (
                <li key={p.id}>
                  <strong>Pedido #{p.id}</strong>
                  {linhasPedido(p).map((linha, i) => (
                    <span key={i}>{linha}</span>
                  ))}
                  {p.tipo === 'ALUGUEL' && !p.devolvidoEm && (
                    <div className="acoes">
                      <button type="button" onClick={() => devolver(p.id)}>
                        Devolver
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
