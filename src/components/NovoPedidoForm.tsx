import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { criarPedido, editarPedido } from '../services/api';
import Selecao from './Selecao';
import {
  dataLocal,
  erroDesconto,
  erroVencimento,
  faixaDesconto,
  mesmoConteudo,
  MSG_INADIMPLENTE_SEM_DESCONTO,
  hojeAAAAMMDD,
  pagoNaHora,
  resumoPedido,
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
import { moeda } from '../utils';

interface NovoPedidoFormProps {
  clientes: ClienteListarResponse[];
  produtos: ProdutoListarResponse[];
  /** Pedido sendo editado (ainda não pago). Sem ele, o formulário cria um pedido novo. */
  pedido?: Pedido;
  onSalvo: (pedido: Pedido) => void;
  onCancelar: () => void;
  onEnviando: (enviando: boolean) => void;
}

/** Produto escolhido no pedido; a quantidade fica como texto porque vem do <input>. */
type Linha = { produtoId: number; quantidade: string };

export default function NovoPedidoForm({
  clientes,
  produtos,
  pedido: original,
  onSalvo,
  onCancelar,
  onEnviando,
}: NovoPedidoFormProps) {
  const editando = !!original;
  const inadimplenteOriginal = !!clientes.find((c) => c.id === original?.clienteId)?.inadimplente;
  const [tipo, setTipo] = useState<TipoPedido>(original?.tipo ?? 'VENDA');
  const [clienteId, setClienteId] = useState(original ? String(original.clienteId) : '');
  const [linhas, setLinhas] = useState<Linha[]>(
    original?.itens.map((i) => ({ produtoId: i.produtoId, quantidade: String(i.quantidade) })) ?? [],
  );
  const [escolhendo, setEscolhendo] = useState(false); // lista de produtos aberta
  const [meses, setMeses] = useState(String(original?.meses ?? 1)); // só aluguel
  // Na edição, a forma de pagamento nunca muda sozinha (um pedido a prazo pode continuar a prazo
  // mesmo com o cliente inadimplente).
  const [pagamento, setPagamento] = useState<FormaPagamento>(original?.pagamento ?? 'PIX');
  // '' = sem solicitação. Inadimplente não pode solicitar: na edição, a solicitação sai.
  const [descontoSolicitado, setDescontoSolicitado] = useState(
    original?.solicitacao && !inadimplenteOriginal ? String(original.solicitacao.percentual) : '',
  );
  const [descricao, setDescricao] = useState(original?.descricao ?? '');
  const [dataVencimento, setDataVencimento] = useState(
    original?.pagamento === 'A_PRAZO' ? dataLocal(original.vencimento) : '',
  ); // AAAA-MM-DD, só a prazo
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Pedido que já era a prazo: cliente e vencimento ficam travados, e pode continuar a prazo.
  const eraAPrazo = original?.pagamento === 'A_PRAZO';
  const vencimentoTravado = eraAPrazo && pagamento === 'A_PRAZO';
  const aluguel = tipo === 'ALUGUEL';
  const quantidadeMeses = Number(meses);
  // Cliente desativado não entra em pedido novo (na edição, o cliente atual continua na lista).
  const clientesEscolha = clientes.filter((c) => c.ativo !== false || c.id === original?.clienteId);
  const cliente = clientesEscolha.find((c) => String(c.id) === clienteId);
  const inadimplente = !!cliente?.inadimplente;
  // Na edição, o crédito reservado por este pedido volta para o cliente antes de reservar o novo total.
  const limiteDisponivel = cliente
    ? cliente.limiteCredito + (cliente.id === original?.clienteId ? (original.creditoUsado ?? 0) : 0)
    : 0;

  // ---------- Produtos ----------
  // Na edição, o estoque que este pedido segura volta para a conta, e os produtos dele continuam
  // na lista mesmo que tenham ficado indisponíveis depois.
  const qtdOriginal = (id: number) => original?.itens.find((i) => i.produtoId === id)?.quantidade ?? 0;
  const disponiveis = produtos
    .map((p) => ({ ...p, estoque: p.estoque + qtdOriginal(p.id) }))
    .filter((p) => (p.status === 'DISPONIVEL' && p.estoque > 0) || qtdOriginal(p.id) > 0);
  const produtoDe = (id: number) => disponiveis.find((p) => p.id === id);
  // Na edição, item que já estava no pedido (mesmo tipo) mantém o preço do momento do pedido.
  const precoDe = (p: ProdutoListarResponse) => {
    const anterior = original?.tipo === tipo ? original.itens.find((i) => i.produtoId === p.id) : undefined;
    return anterior?.precoUnitario ?? Number(aluguel ? p.precoAluguel : p.precoVenda);
  };
  const quantidadeValida = (l: Linha) => {
    const p = produtoDe(l.produtoId);
    const q = Number(l.quantidade);
    return !!p && l.quantidade !== '' && Number.isInteger(q) && q > 0 && q <= p.estoque;
  };
  const restantes = disponiveis.filter((p) => !linhas.some((l) => l.produtoId === p.id));
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
  }

  function fecharSeletorComEsc(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation(); // fecha só a lista, não o popup inteiro
      setEscolhendo(false);
    }
  }

  // ---------- Desconto e prévia ----------
  const faixa = faixaDesconto(cliente?.categoria ?? 'NORMAL');
  // Na edição, mesmo cliente e mesmo percentual: a solicitação (e a decisão já tomada) continua.
  // Inadimplente não solicita: o campo fica bloqueado e nada é enviado.
  const textoDesconto = inadimplente ? '' : descontoSolicitado.trim();
  const mantemSolicitacao =
    !!original?.solicitacao &&
    original.clienteId === cliente?.id &&
    String(original.solicitacao.percentual) === textoDesconto &&
    mesmoConteudo(original, { tipo, pagamento, meses: aluguel ? quantidadeMeses : undefined, itens });
  const solicitacao: SolicitacaoDesconto | undefined = mantemSolicitacao
    ? original!.solicitacao
    : cliente && textoDesconto !== ''
      ? { percentual: Number(textoDesconto), status: 'PENDENTE' }
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
  const acimaDoLimite = !!cliente && pagamento === 'A_PRAZO' && resumo.total > limiteDisponivel;

  function escolherCliente(id: string) {
    setClienteId(id);
    setDescontoSolicitado(''); // a faixa muda conforme a categoria do cliente
    const escolhido = clientesEscolha.find((c) => String(c.id) === id);
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
    if (inadimplente && pagamento === 'A_PRAZO' && !eraAPrazo) {
      return setErro('Cliente inadimplente: não pode fazer pedido a prazo. Use PIX ou à vista.');
    }
    if (pagamento === 'A_PRAZO' && !vencimentoTravado) {
      const erroData = erroVencimento(dataVencimento);
      if (erroData) return setErro(erroData);
    }
    if (erroDoDesconto) return setErro(erroDoDesconto);

    setEnviando(true);
    onEnviando(true);
    try {
      const dados = {
        tipo,
        clienteId: cliente.id,
        pagamento,
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
        meses: aluguel ? quantidadeMeses : undefined,
        descontoSolicitado: solicitacao?.percentual,
        descricao: descricao.trim() || undefined,
        dataVencimento: pagamento === 'A_PRAZO' ? dataVencimento : undefined,
      };
      onSalvo(original ? await editarPedido(original.id, dados) : await criarPedido(dados));
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
          <Selecao<TipoPedido>
            value={tipo}
            onChange={setTipo}
            opcoes={[
              { valor: 'VENDA', rotulo: 'Venda' },
              { valor: 'ALUGUEL', rotulo: 'Aluguel', detalhe: 'por mês' },
            ]}
          />
        </label>
        <label className="campo">
          <span>Cliente</span>
          <Selecao
            value={clienteId}
            onChange={escolherCliente}
            disabled={eraAPrazo}
            placeholder="Selecione o cliente"
            opcoes={clientesEscolha.map((c) => ({
              valor: String(c.id),
              rotulo: c.name,
              detalhe: c.inadimplente ? `${c.categoria === 'VIP' ? 'VIP · ' : ''}inadimplente` : c.categoria === 'VIP' ? 'VIP' : undefined,
            }))}
          />
        </label>
      </div>
      {clientesEscolha.length === 0 && <p className="dica">Nenhum cliente ativo cadastrado.</p>}
      {eraAPrazo && (
        <p className="dica">Pedido a prazo: o cliente e o vencimento não podem ser alterados.</p>
      )}

      {cliente && (
        <>
          <p className="dica">Limite de crédito disponível: {moeda.format(limiteDisponivel)}</p>
          {inadimplente && (
            <p className="aviso erro">
              Cliente inadimplente: tem pedido a prazo vencido e não pago.{' '}
              {eraAPrazo ? 'Este pedido pode continuar a prazo, mas fica' : 'Só pode comprar com PIX ou à vista,'} sem
              desconto nenhum{cliente.categoria === 'VIP' && ' (perde os 5% automáticos de VIP)'} e sem poder
              solicitar desconto.
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
        <div className="seletor" onKeyDown={fecharSeletorComEsc}>
          <ul className="seletor-lista" aria-label="Produtos disponíveis">
            {restantes.map((p, i) => (
              <li key={p.id}>
                <button type="button" autoFocus={i === 0} onClick={() => adicionar(p.id)}>
                  <span>{p.nome}</span>
                  <small>
                    {moeda.format(precoDe(p))}
                    {aluguel && '/mês'} · Estoque: {p.estoque}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="secundario adicionar" onClick={() => setEscolhendo(false)}>
            Cancelar
          </button>
        </div>
      )}

      {podeAdicionar && (
        <button
          type="button"
          className="secundario adicionar"
          onClick={() => setEscolhendo(true)}
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
          <Selecao<FormaPagamento>
            value={pagamento}
            onChange={setPagamento}
            opcoes={[
              { valor: 'PIX', rotulo: 'PIX' },
              { valor: 'A_VISTA', rotulo: 'À vista' },
              {
                valor: 'A_PRAZO',
                rotulo: 'A prazo',
                detalhe: eraAPrazo
                  ? 'vencimento mantido'
                  : inadimplente
                    ? 'indisponível (inadimplente)'
                    : 'escolha o vencimento',
                desabilitada: inadimplente && !eraAPrazo,
              },
            ]}
          />
        </label>
        {pagamento === 'A_PRAZO' && (
          <label className="campo">
            <span>Vencimento</span>
            <input
              type="date"
              min={vencimentoTravado ? undefined : hojeAAAAMMDD(1)}
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              disabled={vencimentoTravado}
              title={vencimentoTravado ? 'O vencimento de um pedido a prazo não pode ser alterado.' : undefined}
              required
            />
          </label>
        )}
        {cliente && (
          <label className="campo">
            <span>Solicitar desconto (%)</span>
            <input
              type="number"
              placeholder={inadimplente ? 'Indisponível (inadimplente)' : `Opcional: ${faixa.min} a ${faixa.max}`}
              title={inadimplente ? MSG_INADIMPLENTE_SEM_DESCONTO : undefined}
              min={faixa.min}
              max={faixa.max}
              step={1}
              disabled={inadimplente}
              value={inadimplente ? '' : descontoSolicitado}
              onChange={(e) => setDescontoSolicitado(e.target.value)}
            />
          </label>
        )}
        <label className="campo inteiro">
          <span>Descrição (opcional)</span>
          <input
            type="text"
            maxLength={255}
            placeholder="Ex.: equipamentos para a obra do centro"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </label>
      </div>
      {aluguel && <p className="dica">Valor do aluguel: preço por mês × meses × quantidade.</p>}
      {erroDoDesconto && <p className="msg erro">{erroDoDesconto}</p>}
      {solicitacao && !erroDoDesconto && (
        <p className="dica">
          {mantemSolicitacao && solicitacao.status !== 'PENDENTE'
            ? `Solicitação de ${solicitacao.percentual}% já ${solicitacao.status === 'APROVADA' ? 'aprovada' : 'rejeitada'}: a decisão continua valendo enquanto o pedido não mudar.`
            : original?.solicitacao && original.solicitacao.status !== 'PENDENTE'
              ? 'O pedido mudou: a solicitação de desconto volta a aguardar a decisão de um colaborador.'
              : 'O desconto solicitado só é aplicado depois da aprovação de um colaborador.'}
        </p>
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
      {editando && resumo.statusPagamento === 'PAGO' && (
        <p className="aviso erro">
          Atenção: ao salvar, este pedido será marcado como PAGO ({pagamento === 'PIX' ? 'PIX' : 'à vista'} sem
          desconto aguardando decisão) e não poderá mais ser editado.
          {original?.pagamento === 'A_PRAZO' && ' O crédito reservado volta para o limite do cliente.'}
        </p>
      )}
      {acimaDoLimite && <p className="msg erro">Total acima do limite de crédito do cliente.</p>}

      {erro && <p className="msg erro">{erro}</p>}
      <div className="modal-acoes">
        <button type="button" className="secundario" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando...' : editando ? 'Salvar alterações' : 'Fazer pedido'}
        </button>
      </div>
    </form>
  );
}
