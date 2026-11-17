import { useEffect, useState, type FormEvent } from 'react';
import ConfirmarModal from '../components/ConfirmarModal';
import {
  confirmarPedido,
  criarPedido,
  devolverPedido,
  listarClientes,
  listarPedidos,
  listarProdutos,
  pagarPedido,
} from '../services/api';
import {
  aguardaDesconto,
  erroDesconto,
  estaVencido,
  faixaDesconto,
  linhasSolicitacao,
  pagoNaHora,
  podeConfirmar,
  podeDevolver,
  podePagar,
  resumoPedido,
  PRAZO_DIAS,
  ROTULO_PAGAMENTO,
  ROTULO_STATUS_PAGAMENTO,
  ROTULO_STATUS_PEDIDO,
  ROTULO_TIPO,
} from '../regras';
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
    `Cliente: ${p.clienteNome} (${p.clienteCategoria}${p.clienteInadimplente ? ', inadimplente' : ''})`,
    ...(p.clienteInadimplente && p.clienteCategoria === 'VIP' && p.solicitacao?.status !== 'APROVADA'
      ? ['Sem os 5% automáticos de VIP: cliente inadimplente.']
      : []),
    `Itens: ${p.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(', ')}`,
    `Pagamento: ${ROTULO_PAGAMENTO[p.pagamento]}`,
    `Subtotal: ${moeda.format(r.subtotal)}`,
    `Desconto aplicado: ${r.percentual}% (− ${moeda.format(r.valorDesconto)})`,
    `Total: ${moeda.format(r.total)}`,
    ...(p.solicitacao ? linhasSolicitacao(p.solicitacao) : []),
    ...(p.pagamento === 'A_PRAZO'
      ? [`Crédito utilizado: ${moeda.format(p.creditoUsado ?? r.total)}${p.pagoEm ? ' (já devolvido ao limite)' : ''}`]
      : []),
    `Criado em ${dataHoraBR(p.criadoEm)}`,
    aluguel
      ? `Início: ${dataBR(p.emissao)} · Fim do aluguel: ${dataBR(p.vencimento)}`
      : `Emissão: ${dataBR(p.emissao)} · Vencimento: ${dataBR(p.vencimento)}`,
    ...(p.pagoEm ? [`Pago em ${dataHoraBR(p.pagoEm)}`] : []),
    ...(p.concluidoEm ? [`Concluído em ${dataHoraBR(p.concluidoEm)}`] : []),
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
  const [descontoSolicitado, setDescontoSolicitado] = useState(''); // '' = sem solicitação; senão % inteiro da faixa
  const [msg, setMsg] = useState<Mensagem>(null);
  const [enviando, setEnviando] = useState(false);
  const [devolvendo, setDevolvendo] = useState<Pedido | null>(null); // pedido no popup de devolução
  const [processando, setProcessando] = useState(false);

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

  const inadimplente = !!cliente?.inadimplente;
  const faixa = faixaDesconto(cliente?.categoria ?? 'NORMAL', inadimplente);
  const solicitacao: SolicitacaoDesconto | undefined =
    cliente && descontoSolicitado.trim() !== ''
      ? { percentual: Number(descontoSolicitado), status: 'PENDENTE' }
      : undefined;
  const erroDoDesconto =
    cliente && solicitacao ? erroDesconto(solicitacao.percentual, cliente.categoria, inadimplente) : null;

  const resumo = resumoPedido({
    itens,
    clienteCategoria: cliente?.categoria ?? 'NORMAL',
    clienteInadimplente: inadimplente,
    pagamento,
    meses: aluguel ? quantidadeMeses : undefined,
    solicitacao,
    pagoEm: pagoNaHora({ pagamento, solicitacao }) ? new Date().toISOString() : undefined, // prévia
  });
  const acimaDoLimite = !!cliente && pagamento === 'A_PRAZO' && resumo.total > cliente.limiteCredito;
  const prazoBloqueado = inadimplente && pagamento === 'A_PRAZO';

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
    if (prazoBloqueado) {
      return setMsg({ tipo: 'erro', texto: 'Cliente inadimplente: não pode fazer pedido a prazo. Use PIX ou à vista.' });
    }
    if (erroDoDesconto) return setMsg({ tipo: 'erro', texto: erroDoDesconto });

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

  async function confirmar(pedidoId: number) {
    setMsg(null);
    try {
      await confirmarPedido(pedidoId);
      setMsg({ tipo: 'sucesso', texto: `Pedido #${pedidoId} confirmado e concluído.` });
      await carregar();
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    }
  }

  async function pagar(pedidoId: number) {
    setMsg(null);
    try {
      const pedido = await pagarPedido(pedidoId);
      setMsg({
        tipo: 'sucesso',
        texto: `Pagamento do pedido #${pedidoId} registrado. ${moeda.format(pedido.creditoUsado ?? 0)} voltaram ao limite de crédito.`,
      });
      await carregar();
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    }
  }

  async function confirmarDevolucao() {
    if (!devolvendo) return;
    const pedidoId = devolvendo.id;
    setMsg(null);
    setProcessando(true);
    try {
      await devolverPedido(pedidoId);
      setMsg({ tipo: 'sucesso', texto: `Aluguel #${pedidoId} devolvido. Estoque atualizado.` });
      await carregar();
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setProcessando(false);
      setDevolvendo(null);
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

          <select
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value);
              setDescontoSolicitado(''); // a faixa muda conforme a categoria do cliente
              // Inadimplente não compra a prazo: volta para PIX.
              const escolhido = clientes.find((c) => String(c.id) === e.target.value);
              if (escolhido?.inadimplente) setPagamento((atual) => (atual === 'A_PRAZO' ? 'PIX' : atual));
            }}
            required
          >
            <option value="">Selecione o cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.categoria}
                {c.inadimplente ? ', inadimplente' : ''})
              </option>
            ))}
          </select>
          {clientes.length === 0 && <p className="dica">Nenhum cliente cadastrado ainda.</p>}

          {cliente && (
            <>
              <p className="dica">Limite de crédito do cliente: {moeda.format(cliente.limiteCredito)}</p>
              {inadimplente && (
                <p className="msg erro">
                  Cliente inadimplente: tem pedido a prazo vencido e não pago. Só pode comprar com PIX ou à
                  vista{cliente.categoria === 'VIP' && ' e perde os 5% automáticos de VIP'}; desconto só com
                  aprovação de um colaborador.
                </p>
              )}
              {cliente.categoria === 'VIP' && !inadimplente && (
                <p className="dica">
                  Cliente VIP: 5% de desconto automático em qualquer forma de pagamento. Pode solicitar de{' '}
                  {faixa.min}% a {faixa.max}%; se aprovado, substitui os 5% (não soma).
                </p>
              )}
              <label className="linha-produto">
                <span>
                  Solicitar desconto (%)
                  <br />
                  <small>Opcional · de {faixa.min} a {faixa.max} · depende de aprovação</small>
                </span>
                <input
                  type="number"
                  placeholder={`${faixa.min}–${faixa.max}`}
                  min={faixa.min}
                  max={faixa.max}
                  step={1}
                  value={descontoSolicitado}
                  onChange={(e) => setDescontoSolicitado(e.target.value)}
                />
              </label>
              {erroDoDesconto && <p className="msg erro">{erroDoDesconto}</p>}
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
            <option value="A_PRAZO" disabled={inadimplente}>
              {aluguel ? 'A prazo' : `A prazo (${PRAZO_DIAS} dias)`}
              {inadimplente && ' — indisponível (inadimplente)'}
            </option>
          </select>

          <div className="resumo">
            <span>Subtotal: {moeda.format(resumo.subtotal)}</span>
            <span>
              Desconto: {resumo.percentual}% (− {moeda.format(resumo.valorDesconto)})
            </span>
            <strong>Total: {moeda.format(resumo.total)}</strong>
            <span>
              Status do pedido: {ROTULO_STATUS_PEDIDO[resumo.statusPedido]} (conclui só ao confirmar)
            </span>
            <span>Status do pagamento: {ROTULO_STATUS_PAGAMENTO[resumo.statusPagamento]}</span>
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
              {pedidos.map((p) => {
                const r = resumoPedido(p);
                return (
                  <li key={p.id}>
                    <strong>Pedido #{p.id}</strong>
                    <div className="selos">
                      <span className={`selo ${r.statusPedido.toLowerCase()}`}>
                        Pedido: {ROTULO_STATUS_PEDIDO[r.statusPedido]}
                      </span>
                      {estaVencido(p) && <span className="selo vencido">Vencido</span>}
                      <span className={`selo ${r.statusPagamento.toLowerCase()}`}>
                        Pagamento: {ROTULO_STATUS_PAGAMENTO[r.statusPagamento]}
                      </span>
                    </div>
                    {linhasPedido(p).map((linha, i) => (
                      <span key={i}>{linha}</span>
                    ))}
                    {(podeConfirmar(p) || aguardaDesconto(p) || podeDevolver(p) || podePagar(p)) && (
                      <div className="acoes">
                        {(podeConfirmar(p) || aguardaDesconto(p)) && (
                          <button
                            type="button"
                            className="confirmar"
                            disabled={!podeConfirmar(p)}
                            onClick={() => confirmar(p.id)}
                          >
                            Confirmar pedido
                          </button>
                        )}
                        {podePagar(p) && (
                          <button type="button" className="confirmar" onClick={() => pagar(p.id)}>
                            Registrar pagamento
                          </button>
                        )}
                        {aguardaDesconto(p) && (
                          <span className="dica">Aguardando aprovação do desconto.</span>
                        )}
                        {podeDevolver(p) && (
                          <button type="button" onClick={() => setDevolvendo(p)}>
                            Devolver
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    
      <ConfirmarModal
        aberto={devolvendo !== null}
        titulo="Confirmar devolução?"
        textoConfirmar="Confirmar devolução"
        carregando={processando}
        onConfirmar={confirmarDevolucao}
        onCancelar={() => setDevolvendo(null)}
      >
        {devolvendo && (
          <>
            <p>
              <strong>Aluguel #{devolvendo.id}</strong> — {devolvendo.clienteNome}
            </p>
            <p>{devolvendo.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(', ')}</p>
            <p>Os itens voltam ao estoque e o pedido passa para "Devolvido". Essa ação não pode ser desfeita.</p>
          </>
        )}
      </ConfirmarModal>
    </>
  );
}
