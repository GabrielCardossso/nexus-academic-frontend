import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { criarPedido, editarPedido } from '../../services/api';
import Selecao from '../comum/Selecao';
import {
  DESCONTO_VIP,
  descontoNaCriacao,
  descontoNaEdicao,
  erroDataFutura,
  erroDescontoDigitado,
  fracaoDe,
  hojeAAAAMMDD,
  MSG_INADIMPLENTE_NAO_AUMENTA,
  MSG_INADIMPLENTE_SEM_DESCONTO,
  MSG_INADIMPLENTE_SEM_PRAZO,
  percentual,
  ROTULO_STATUS_DESCONTO,
  subtotalDe,
  TETO_NORMAL,
  totalComDesconto,
  valorItem,
  type EstadoDesconto,
} from '../../regras';
import type {
  ClienteListarResponse,
  ItemPedidoCriarRequest,
  ModalidadePagamento,
  Pedido,
  PedidoEditarRequest,
  ProdutoListarResponse,
} from '../../types';
import { moeda } from '../../utils';

interface PedidoFormProps {
  clientes: ClienteListarResponse[];
  produtos: ProdutoListarResponse[];
  /** Pedido sendo editado (PENDENTE). Sem ele, o formulário cria um pedido novo. */
  pedido?: Pedido;
  onSalvo: (mensagem: string) => void;
  onCancelar: () => void;
  onEnviando: (enviando: boolean) => void;
}

/** Produto escolhido. Venda ou aluguel é por item; o aluguel exige a data até quando o cliente fica com ele. */
type Linha = { produtoId: number; quantidade: string; aluguel: boolean; ate: string };

export default function PedidoForm({
  clientes,
  produtos,
  pedido: original,
  onSalvo,
  onCancelar,
  onEnviando,
}: PedidoFormProps) {
  const editando = !!original;
  // Com o back real, GET /pedidos/{id} não traz os itens: na edição eles ficam como estão.
  const itensEditaveis = !original || !!original.itens;
  const descontoInicial =
    original?.descontoSolicitado != null && original.descontoSolicitado > 0
      ? String(Math.round(original.descontoSolicitado * 10000) / 100)
      : '';

  const [clienteId, setClienteId] = useState(original?.clienteId != null ? String(original.clienteId) : '');
  const [linhas, setLinhas] = useState<Linha[]>(
    original?.itens?.map((i) => ({
      produtoId: i.produtoId,
      quantidade: String(i.quantidade),
      aluguel: i.isAluguel,
      ate: i.dataVencimentoAluguel ?? '',
    })) ?? [],
  );
  const [escolhendo, setEscolhendo] = useState(false); // lista de produtos aberta
  const [modalidade, setModalidade] = useState<ModalidadePagamento>(original?.modalidadePagamento ?? 'A_VISTA');
  const [descontoTexto, setDescontoTexto] = useState(descontoInicial);
  const [descricao, setDescricao] = useState(original?.descricao ?? '');
  const [dataVencimento, setDataVencimento] = useState(original?.dataVencimento ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const eraAPrazo = original?.modalidadePagamento === 'A_PRAZO';
  // TRAVA DO FRONT: o vencimento de um pedido que já era a prazo não muda (senão daria para adiar a dívida).
  const vencimentoTravado = eraAPrazo;

  // ---------- Cliente ----------
  // O back não muda o cliente na edição. Cliente desativado não entra em pedido novo.
  const clientesEscolha = editando
    ? clientes.filter((c) => c.id === original!.clienteId || c.email === original!.clienteEmail)
    : clientes.filter((c) => c.ativo !== false);
  const cliente = editando ? clientesEscolha[0] : clientesEscolha.find((c) => String(c.id) === clienteId);
  const categoria = cliente?.categoria ?? original?.clienteClassificacao ?? 'NORMAL';
  const inadimplente = !!cliente?.inadimplente;
  // Na edição de um pedido a prazo, o total dele volta para o limite antes de reservar o novo.
  const limiteDisponivel = (cliente?.limiteCredito ?? 0) + (eraAPrazo ? original!.valorTotal : 0);

  // ---------- Produtos ----------
  // Na edição, o estoque que este pedido segura volta para a conta (menos aluguel já devolvido).
  const qtdOriginal = (id: number) =>
    (original?.itens ?? [])
      .filter((i) => i.produtoId === id && !(i.isAluguel && i.dataDevolucao))
      .reduce((s, i) => s + i.quantidade, 0);
  // TRAVA DO FRONT: produto INDISPONIVEL ou DESATIVADO não entra em pedido (o back hoje aceita).
  const disponiveis = produtos
    .map((p) => ({ ...p, estoque: p.estoque + qtdOriginal(p.id) }))
    .filter((p) => (p.status !== 'INDISPONIVEL' && p.status !== 'DESATIVADO' && p.estoque > 0) || qtdOriginal(p.id) > 0);
  const produtoDe = (id: number) => disponiveis.find((p) => p.id === id);
  const quantidadeValida = (l: Linha) => {
    const p = produtoDe(l.produtoId);
    const q = Number(l.quantidade);
    return !!p && l.quantidade !== '' && Number.isInteger(q) && q > 0 && q <= p.estoque;
  };
  const restantes = disponiveis.filter((p) => !linhas.some((l) => l.produtoId === p.id));
  const todasValidas = linhas.every(quantidadeValida);
  const podeAdicionar = !escolhendo && restantes.length > 0 && todasValidas;

  const itensPrevia = linhas.flatMap((l) => {
    const p = produtoDe(l.produtoId);
    return p && quantidadeValida(l) ? [{ valorItem: valorItem(p, Number(l.quantidade), l.aluguel) }] : [];
  });

  function mudarLinha(produtoId: number, mudanca: Partial<Linha>) {
    setLinhas((ls) => ls.map((x) => (x.produtoId === produtoId ? { ...x, ...mudanca } : x)));
  }

  function fecharSeletorComEsc(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation(); // fecha só a lista, não o popup inteiro
      setEscolhendo(false);
    }
  }

  // ---------- Desconto e prévia (mesmas regras do back) ----------
  // Inadimplente: o campo fica bloqueado (o back registra como reprovado por inadimplência).
  const descontoBloqueado = inadimplente || original?.statusAprovacaoDesconto === 'REPROVADO_INADIPLENCIA';
  const erroDoDesconto = descontoBloqueado ? null : erroDescontoDigitado(descontoTexto);
  const fracao = descontoBloqueado || erroDoDesconto ? 0 : fracaoDe(descontoTexto);
  // Na edição, o desconto só vai no corpo se mudou (o que não vai, o back mantém).
  const enviarDesconto = !editando || (!descontoBloqueado && descontoTexto.trim() !== descontoInicial);

  let desconto: EstadoDesconto | null = null;
  if (!editando && cliente) {
    desconto = descontoNaCriacao(fracao, categoria, inadimplente);
  } else if (original && original.descontoAutorizado !== undefined && original.descontoSolicitado !== undefined) {
    desconto = descontoNaEdicao(
      {
        descontoSolicitado: original.descontoSolicitado,
        descontoAutorizado: original.descontoAutorizado,
        statusAprovacaoDesconto: original.statusAprovacaoDesconto,
      },
      enviarDesconto ? fracao : undefined,
      categoria,
    );
  }
  const temPrevia = itensEditaveis && desconto !== null && itensPrevia.length > 0;
  const subtotal = subtotalDe(itensPrevia);
  const total = desconto ? totalComDesconto(subtotal, desconto.descontoAutorizado) : subtotal;
  const acimaDoLimite = temPrevia && modalidade === 'A_PRAZO' && !!cliente && total > limiteDisponivel;
  // TRAVA DO FRONT: inadimplente continuando a prazo não pode aumentar o total (seria uma compra nova a prazo).
  const inadimplenteAumenta = temPrevia && eraAPrazo && inadimplente && modalidade === 'A_PRAZO' && total > original!.valorTotal;
  const itensMudaram =
    editando &&
    itensEditaveis &&
    JSON.stringify(linhas.map((l) => [l.produtoId, l.quantidade, l.aluguel, l.aluguel ? l.ate : ''])) !==
      JSON.stringify(
        (original!.itens ?? []).map((i) => [i.produtoId, String(i.quantidade), i.isAluguel, i.isAluguel ? (i.dataVencimentoAluguel ?? '') : '']),
      );

  // ---------- Pendências do back (sem id/cnpj na listagem) ----------
  const semCnpj = !editando && !!cliente && !cliente.cnpj;
  const produtoSemId = linhas.some((l) => l.produtoId <= 0);

  function escolherCliente(id: string) {
    setClienteId(id);
    setDescontoTexto('');
    const escolhido = clientesEscolha.find((c) => String(c.id) === id);
    if (escolhido?.inadimplente && modalidade === 'A_PRAZO') setModalidade('A_VISTA'); // inadimplente não compra a prazo
  }

  function itensParaEnviar(): ItemPedidoCriarRequest[] {
    return linhas.map((l) => ({
      codigoIdProduto: l.produtoId,
      quantidade: Number(l.quantidade),
      isAluguel: l.aluguel,
      ...(l.aluguel ? { dataVencimentoAluguel: l.ate } : {}),
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!cliente && !editando) return setErro('Selecione um cliente.');
    if (semCnpj) {
      return setErro('O back ainda não devolve o CNPJ na listagem de clientes, e o pedido é criado pelo CNPJ.');
    }
    if (itensEditaveis) {
      if (linhas.length === 0) return setErro('Selecione pelo menos um produto.');
      if (!todasValidas) return setErro('Confira a quantidade dos produtos selecionados.');
      if (produtoSemId) return setErro('O back ainda não devolve o id na listagem de produtos, e o pedido usa o id.');
      for (const l of linhas) {
        if (!l.aluguel) continue;
        const erroData = erroDataFutura(l.ate, `a data de devolução do aluguel de ${produtoDe(l.produtoId)?.nome}`);
        if (erroData) return setErro(erroData);
      }
    }
    if (inadimplente && modalidade === 'A_PRAZO' && !eraAPrazo) return setErro(MSG_INADIMPLENTE_SEM_PRAZO);
    if (modalidade === 'A_PRAZO' && !vencimentoTravado) {
      const erroData = erroDataFutura(dataVencimento, 'a data de vencimento do pedido');
      if (erroData) return setErro(erroData);
    }
    if (erroDoDesconto) return setErro(erroDoDesconto);
    if (inadimplenteAumenta) return setErro(MSG_INADIMPLENTE_NAO_AUMENTA);

    setEnviando(true);
    onEnviando(true);
    try {
      if (original) {
        const corpo: PedidoEditarRequest = {
          descricao: descricao.trim(),
          modalidadePagamento: modalidade,
          ...(modalidade === 'A_PRAZO' && !vencimentoTravado ? { dataVencimento } : {}),
          ...(enviarDesconto ? { descontoSolicitado: fracao } : {}),
          ...(itensEditaveis ? { itensPedido: itensParaEnviar() } : {}),
        };
        await editarPedido(original.id, corpo);
        onSalvo(`Pedido #${original.id} atualizado!`);
      } else {
        const r = await criarPedido({
          CNPJcliente: cliente!.cnpj!,
          descontoSolicitado: fracao,
          itensPedido: itensParaEnviar(),
          modalidadePagamento: modalidade,
          ...(modalidade === 'A_PRAZO' ? { dataVencimento } : {}),
          ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
        });
        onSalvo(`Pedido #${r.id} realizado! Total: ${moeda.format(r.valorTotal)}.`);
      }
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
        <label className="campo inteiro">
          <span>Cliente</span>
          {editando ? (
            <input type="text" value={original!.clienteNome} disabled title="O cliente de um pedido não pode ser trocado." />
          ) : (
            <Selecao
              value={clienteId}
              onChange={escolherCliente}
              placeholder="Selecione o cliente"
              opcoes={clientesEscolha.map((c) => ({
                valor: String(c.id),
                rotulo: c.name,
                detalhe: c.inadimplente ? `${c.categoria === 'VIP' ? 'VIP · ' : ''}inadimplente` : c.categoria === 'VIP' ? 'VIP' : undefined,
              }))}
            />
          )}
        </label>
      </div>
      {!editando && clientesEscolha.length === 0 && <p className="dica">Nenhum cliente ativo cadastrado.</p>}
      {editando && <p className="dica">O cliente de um pedido não pode ser trocado.</p>}

      {cliente && (
        <>
          <p className="dica">Limite de crédito disponível: {moeda.format(limiteDisponivel)}</p>
          {inadimplente && (
            <p className="aviso erro">
              Cliente inadimplente: tem pedido pendente com vencimento antes de hoje.{' '}
              {eraAPrazo ? 'Este pedido pode continuar a prazo, sem aumentar o total.' : 'Não pode fazer pedido a prazo.'}{' '}
              {MSG_INADIMPLENTE_SEM_DESCONTO}
            </p>
          )}
          {semCnpj && (
            <p className="aviso erro">
              O back ainda não devolve o CNPJ na listagem de clientes, e o pedido é criado pelo CNPJ: não dá para criar
              pedido pela tela até o back incluir esse campo.
            </p>
          )}
        </>
      )}

      <h3 className="secao-titulo">Produtos</h3>
      {!itensEditaveis && (
        <p className="dica">
          O back ainda não devolve os itens do pedido: os produtos ficam como estão. Os outros campos podem ser alterados.
        </p>
      )}
      {itensEditaveis && disponiveis.length === 0 && <p className="vazio">Nenhum produto disponível com estoque.</p>}

      {itensEditaveis && linhas.length > 0 && (
        <ul className="produtos-escolhidos">
          {linhas.map((l) => {
            const p = produtoDe(l.produtoId);
            if (!p) return null;
            const passouEstoque = Number(l.quantidade) > p.estoque;
            const preco = Number(l.aluguel ? p.precoAluguel : p.precoVenda);
            return (
              <li key={l.produtoId} className="produto-escolhido">
                <span>
                  <strong>{p.nome}</strong>
                  <br />
                  <small>
                    {moeda.format(preco)} {l.aluguel ? 'aluguel' : 'venda'} · Estoque: {p.estoque}
                  </small>
                </span>
                <input
                  type="number"
                  placeholder="Qtd."
                  aria-label={`Quantidade de ${p.nome}`}
                  min={1}
                  max={p.estoque}
                  step={1}
                  autoFocus={!editando}
                  value={l.quantidade}
                  onChange={(e) => mudarLinha(l.produtoId, { quantidade: e.target.value })}
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
                <div className="item-aluguel">
                  <label>
                    <input
                      type="checkbox"
                      checked={l.aluguel}
                      onChange={(e) => mudarLinha(l.produtoId, { aluguel: e.target.checked })}
                    />
                    Aluguel
                  </label>
                  {l.aluguel && (
                    <label>
                      Devolver até
                      <input
                        type="date"
                        aria-label={`Data de devolução do aluguel de ${p.nome}`}
                        min={hojeAAAAMMDD(1)}
                        value={l.ate}
                        onChange={(e) => mudarLinha(l.produtoId, { ate: e.target.value })}
                        required
                      />
                    </label>
                  )}
                </div>
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
                <button
                  type="button"
                  autoFocus={i === 0}
                  onClick={() => {
                    setLinhas((ls) => [...ls, { produtoId: p.id, quantidade: '', aluguel: false, ate: '' }]);
                    setEscolhendo(false);
                  }}
                >
                  <span>{p.nome}</span>
                  <small>
                    Venda {moeda.format(Number(p.precoVenda))} · Aluguel {moeda.format(Number(p.precoAluguel))} · Estoque:{' '}
                    {p.estoque}
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

      {itensEditaveis && podeAdicionar && (
        <button type="button" className="secundario adicionar" onClick={() => setEscolhendo(true)}>
          + Selecionar produto
        </button>
      )}
      {itensEditaveis && !escolhendo && linhas.length > 0 && !todasValidas && (
        <p className="dica">Informe a quantidade para poder selecionar outro produto.</p>
      )}
      {itensEditaveis && linhas.some((l) => l.aluguel) && (
        <p className="dica">Aluguel: preço de aluguel × quantidade (o valor não muda com a data de devolução).</p>
      )}

      <div className="form-grade">
        <label className="campo">
          <span>Pagamento</span>
          <Selecao<ModalidadePagamento>
            value={modalidade}
            onChange={setModalidade}
            opcoes={[
              { valor: 'A_VISTA', rotulo: 'À vista' },
              {
                valor: 'A_PRAZO',
                rotulo: 'A prazo',
                detalhe: eraAPrazo ? 'vencimento mantido' : inadimplente ? 'indisponível (inadimplente)' : 'escolha o vencimento',
                desabilitada: inadimplente && !eraAPrazo,
              },
            ]}
          />
        </label>
        {modalidade === 'A_PRAZO' && (
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
        {(cliente || editando) && (
          <label className="campo">
            <span>Solicitar desconto (%)</span>
            <input
              type="number"
              placeholder={descontoBloqueado ? 'Indisponível (inadimplente)' : 'Opcional: 0 a 15'}
              title={descontoBloqueado ? MSG_INADIMPLENTE_SEM_DESCONTO : undefined}
              min={0}
              max={15}
              step="any"
              disabled={descontoBloqueado}
              value={descontoBloqueado ? '' : descontoTexto}
              onChange={(e) => setDescontoTexto(e.target.value)}
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

      {erroDoDesconto && <p className="msg erro">{erroDoDesconto}</p>}
      {!descontoBloqueado && (cliente || editando) && (
        <p className="dica">
          {categoria === 'VIP'
            ? `Cliente VIP: pedindo até 5%, recebe ${percentual(DESCONTO_VIP)} na hora. Acima de 5% (até 15%) precisa da aprovação de um colaborador e, enquanto isso, o pedido fica sem desconto; se reprovado, volta a 5%.`
            : `Cliente Normal: qualquer desconto precisa da aprovação de um colaborador. Acima de ${percentual(TETO_NORMAL)}, o back limita em ${percentual(TETO_NORMAL)}.`}
        </p>
      )}
      {categoria === 'NORMAL' && !descontoBloqueado && fracao > TETO_NORMAL && (
        <p className="aviso">O desconto solicitado vai ser limitado a {percentual(TETO_NORMAL)} (regra do back).</p>
      )}
      {editando && itensMudaram && original!.statusAprovacaoDesconto === 'APROVADO' && (
        <p className="aviso">
          Atenção: o desconto já aprovado ({percentual(original!.descontoAutorizado)}) continua valendo depois desta edição,
          mesmo com os produtos alterados (regra do back).
        </p>
      )}

      <div className="resumo">
        {temPrevia ? (
          <>
            <span>Subtotal: {moeda.format(subtotal)}</span>
            <span>
              Desconto: {percentual(desconto!.descontoAutorizado)} (− {moeda.format(subtotal - total)})
            </span>
            <strong className="total-linha">
              <span>Total</span>
              <span>{moeda.format(total)}</span>
            </strong>
            <span>Desconto: {ROTULO_STATUS_DESCONTO[desconto!.statusAprovacaoDesconto]}</span>
          </>
        ) : (
          <span>{editando ? 'O back recalcula o total ao salvar.' : 'Escolha o cliente e os produtos para ver o total.'}</span>
        )}
        <span>O pedido fica pendente até alguém clicar em "Finalizar" (registra o pagamento).</span>
      </div>
      {modalidade === 'A_PRAZO' && <p className="dica">O total fica reservado no limite de crédito do cliente até ser finalizado.</p>}
      {acimaDoLimite && <p className="msg erro">Total acima do limite de crédito do cliente.</p>}
      {inadimplenteAumenta && <p className="msg erro">{MSG_INADIMPLENTE_NAO_AUMENTA}</p>}

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
