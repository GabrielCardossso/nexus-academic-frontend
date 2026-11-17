import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { criarPedido } from '../services/api';
import {
  erroDesconto,
  faixaDesconto,
  pagoNaHora,
  resumoPedido,
  PRAZO_DIAS,
  ROTULO_STATUS_PAGAMENTO,
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
import { contem, moeda } from '../utils';

interface NovoPedidoFormProps {
  clientes: ClienteListarResponse[];
  produtos: ProdutoListarResponse[];
  onCriado: (pedido: Pedido) => void;
  onCancelar: () => void;
  onEnviando: (enviando: boolean) => void;
}

/** Produto escolhido no pedido; a quantidade fica como texto porque vem do <input>. */
type Linha = { produtoId: number; quantidade: string };

export default function NovoPedidoForm({ clientes, produtos, onCriado, onCancelar, onEnviando }: NovoPedidoFormProps) {
  const [tipo, setTipo] = useState<TipoPedido>('VENDA');
  const [clienteId, setClienteId] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [escolhendo, setEscolhendo] = useState(false); // lista de produtos aberta
  const [buscaProduto, setBuscaProduto] = useState('');
  const [meses, setMeses] = useState('1'); // só aluguel
  const [pagamento, setPagamento] = useState<FormaPagamento>('PIX');
  const [descontoSolicitado, setDescontoSolicitado] = useState(''); // '' = sem solicitação
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aluguel = tipo === 'ALUGUEL';
  const quantidadeMeses = Number(meses);
  const cliente = clientes.find((c) => String(c.id) === clienteId);
  const inadimplente = !!cliente?.inadimplente;

  // ---------- Produtos ----------
  const disponiveis = produtos.filter((p) => p.status === 'DISPONIVEL' && p.estoque > 0);
  const produtoDe = (id: number) => disponiveis.find((p) => p.id === id);
  const precoDe = (p: ProdutoListarResponse) => Number(aluguel ? p.precoAluguel : p.precoVenda);
  const quantidadeValida = (l: Linha) => {
    const p = produtoDe(l.produtoId);
    const q = Number(l.quantidade);
    return !!p && l.quantidade !== '' && Number.isInteger(q) && q > 0 && q <= p.estoque;
  };
  const restantes = disponiveis.filter((p) => !linhas.some((l) => l.produtoId === p.id));
  const encontrados = restantes.filter((p) => contem(buscaProduto, p.nome, p.descricao));
  const todasValidas = linhas.every(quantidadeValida);
  // Só libera escolher outro produto quando o anterior já tem quantidade válida.
  const podeAdicionar = !escolhendo && restantes.length > 0 && todasValidas;

  const itens: ItemPedido[] = linhas.flatMap((l) => {
    const p = produtoDe(l.produtoId);
    return p && quantidadeValida(l)
      ? [{ produtoId: p.id, nome: p.nome, precoUnitario: precoDe(p), quantidade: Number(l.quantidade) }]
      : [];
  });

  function adicionar(produtoId: number) {
    setLinhas((ls) => [...ls, { produtoId, quantidade: '' }]);
    setEscolhendo(false);
    setBuscaProduto('');
  }

  function fecharSeletorComEsc(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation(); // fecha só a lista, não o popup inteiro
      setEscolhendo(false);
    }
  }

  // ---------- Desconto e prévia ----------
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

  function escolherCliente(id: string) {
    setClienteId(id);
    setDescontoSolicitado(''); // a faixa muda conforme a categoria do cliente
    const escolhido = clientes.find((c) => String(c.id) === id);
    if (escolhido?.inadimplente && pagamento === 'A_PRAZO') setPagamento('PIX'); // inadimplente não compra a prazo
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!cliente) return setErro('Selecione um cliente.');
    if (linhas.length === 0) return setErro('Selecione pelo menos um produto.');
    if (!todasValidas) return setErro('Confira a quantidade dos produtos selecionados.');
    if (aluguel && (!Number.isInteger(quantidadeMeses) || quantidadeMeses <= 0)) {
      return setErro('Informe a duração do aluguel em meses.');
    }
    if (inadimplente && pagamento === 'A_PRAZO') {
      return setErro('Cliente inadimplente: não pode fazer pedido a prazo. Use PIX ou à vista.');
    }
    if (erroDoDesconto) return setErro(erroDoDesconto);

    setEnviando(true);
    onEnviando(true);
    try {
      const pedido = await criarPedido({
        tipo,
        clienteId: cliente.id,
        pagamento,
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
        meses: aluguel ? quantidadeMeses : undefined,
        descontoSolicitado: solicitacao?.percentual,
      });
      onCriado(pedido);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
      onEnviando(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-grade">
        <label className="campo">
          <span>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPedido)}>
            <option value="VENDA">Venda</option>
            <option value="ALUGUEL">Aluguel</option>
          </select>
        </label>
        <label className="campo">
          <span>Cliente</span>
          <select value={clienteId} onChange={(e) => escolherCliente(e.target.value)} required>
            <option value="">Selecione o cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.categoria}
                {c.inadimplente ? ', inadimplente' : ''})
              </option>
            ))}
          </select>
        </label>
      </div>
      {clientes.length === 0 && <p className="dica">Nenhum cliente cadastrado ainda.</p>}

      {cliente && (
        <>
          <p className="dica">Limite de crédito disponível: {moeda.format(cliente.limiteCredito)}</p>
          {inadimplente && (
            <p className="aviso erro">
              Cliente inadimplente: tem pedido a prazo vencido e não pago. Só pode comprar com PIX ou à vista
              {cliente.categoria === 'VIP' && ' e perde os 5% automáticos de VIP'}; desconto só com aprovação de
              um colaborador.
            </p>
          )}
          {cliente.categoria === 'VIP' && !inadimplente && (
            <p className="dica">
              Cliente VIP: 5% de desconto automático em qualquer forma de pagamento. Pode solicitar de {faixa.min}% a{' '}
              {faixa.max}%.
            </p>
          )}
        </>
      )}

      <h3 className="secao-titulo">Produtos</h3>
      {disponiveis.length === 0 && <p className="vazio">Nenhum produto disponível com estoque.</p>}

      {linhas.length > 0 && (
        <ul className="produtos-escolhidos">
          {linhas.map((l) => {
            const p = produtoDe(l.produtoId);
            if (!p) return null;
            const passouEstoque = Number(l.quantidade) > p.estoque;
            return (
              <li key={l.produtoId} className="produto-escolhido">
                <span>
                  <strong>{p.nome}</strong>
                  <br />
                  <small>
                    {moeda.format(precoDe(p))}
                    {aluguel && '/mês'} · Estoque: {p.estoque}
                  </small>
                </span>
                <input
                  type="number"
                  placeholder="Qtd."
                  aria-label={`Quantidade de ${p.nome}`}
                  min={1}
                  max={p.estoque}
                  step={1}
                  autoFocus
                  value={l.quantidade}
                  onChange={(e) =>
                    setLinhas((ls) =>
                      ls.map((x) => (x.produtoId === l.produtoId ? { ...x, quantidade: e.target.value } : x)),
                    )
                  }
                />
                <button
                  type="button"
                  className="remover"
                  aria-label={`Remover ${p.nome}`}
                  title="Remover produto"
                  onClick={() => setLinhas((ls) => ls.filter((x) => x.produtoId !== l.produtoId))}
                >
                  ×
                </button>
                {passouEstoque && <p className="msg erro">Só há {p.estoque} em estoque.</p>}
              </li>
            );
          })}
        </ul>
      )}

      {escolhendo && (
        <div className="seletor">
          <input
            type="search"
            placeholder="Buscar produto"
            aria-label="Buscar produto"
            autoFocus
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
            onKeyDown={fecharSeletorComEsc}
          />
          {encontrados.length === 0 ? (
            <p className="vazio">Nenhum produto encontrado.</p>
          ) : (
            <ul className="seletor-lista">
              {encontrados.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => adicionar(p.id)}>
                    <span>{p.nome}</span>
                    <small>
                      {moeda.format(precoDe(p))}
                      {aluguel && '/mês'} · Estoque: {p.estoque}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="secundario adicionar" onClick={() => setEscolhendo(false)}>
            Cancelar
          </button>
        </div>
      )}

      {podeAdicionar && (
        <button
          type="button"
          className="secundario adicionar"
          onClick={() => {
            setBuscaProduto('');
            setEscolhendo(true);
          }}
        >
          + Selecionar produto
        </button>
      )}
      {!escolhendo && linhas.length > 0 && !todasValidas && (
        <p className="dica">Informe a quantidade para poder selecionar outro produto.</p>
      )}

      <div className="form-grade">
        {aluguel && (
          <label className="campo">
            <span>Duração do aluguel (meses)</span>
            <input type="number" min={1} step={1} value={meses} onChange={(e) => setMeses(e.target.value)} required />
          </label>
        )}
        <label className="campo">
          <span>Pagamento</span>
          <select value={pagamento} onChange={(e) => setPagamento(e.target.value as FormaPagamento)}>
            <option value="PIX">PIX</option>
            <option value="A_VISTA">À vista</option>
            <option value="A_PRAZO" disabled={inadimplente}>
              {aluguel ? 'A prazo' : `A prazo (${PRAZO_DIAS} dias)`}
              {inadimplente && ' — indisponível (inadimplente)'}
            </option>
          </select>
        </label>
        {cliente && (
          <label className="campo">
            <span>Solicitar desconto (%)</span>
            <input
              type="number"
              placeholder={`Opcional: ${faixa.min} a ${faixa.max}`}
              min={faixa.min}
              max={faixa.max}
              step={1}
              value={descontoSolicitado}
              onChange={(e) => setDescontoSolicitado(e.target.value)}
            />
          </label>
        )}
      </div>
      {aluguel && <p className="dica">Valor do aluguel: preço por mês × meses × quantidade.</p>}
      {erroDoDesconto && <p className="msg erro">{erroDoDesconto}</p>}
      {solicitacao && !erroDoDesconto && (
        <p className="dica">O desconto solicitado só é aplicado depois da aprovação de um colaborador.</p>
      )}

      <div className="resumo">
        <span>Subtotal: {moeda.format(resumo.subtotal)}</span>
        <span>
          Desconto: {resumo.percentual}% (− {moeda.format(resumo.valorDesconto)})
        </span>
        <strong className="total-linha">
          <span>Total</span>
          <span>{moeda.format(resumo.total)}</span>
        </strong>
        <span>Pagamento: {ROTULO_STATUS_PAGAMENTO[resumo.statusPagamento]} · o pedido conclui só ao ser confirmado</span>
      </div>
      {pagamento === 'A_PRAZO' && <p className="dica">O total será descontado do limite de crédito do cliente.</p>}
      {acimaDoLimite && <p className="msg erro">Total acima do limite de crédito do cliente.</p>}

      {erro && <p className="msg erro">{erro}</p>}
      <div className="modal-acoes">
        <button type="button" className="secundario" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Fazer pedido'}
        </button>
      </div>
    </form>
  );
}
