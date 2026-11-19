import { useState } from 'react';
import {
  aguardaDesconto,
  CLASSE_STATUS_DESCONTO,
  estaVencido,
  percentual,
  podeDevolver,
  podeEditar,
  podeExcluir,
  podeFinalizar,
  ROTULO_PAGAMENTO,
  ROTULO_STATUS_DESCONTO,
  ROTULO_STATUS_PEDIDO,
  subtotalDe,
  tipoDoPedido,
} from '../../regras';
import type { ItemPedido, Pedido } from '../../types';
import { dataBR, moeda } from '../../utils';

interface PedidoCardProps {
  pedido: Pedido;
  /** Cliente do pedido está inadimplente (tem pedido pendente vencido). */
  clienteInadimplente: boolean;
  onFinalizar: (p: Pedido) => void;
  onDevolver: (p: Pedido) => void;
  onEditar: (p: Pedido) => void;
  onExcluir: (p: Pedido) => void;
}

type Detalhe = { rotulo: string; valor: string; largo?: boolean };

const textoItem = (i: ItemPedido) =>
  `${i.quantidade}× ${i.nomeProduto} (${i.isAluguel ? 'aluguel' : 'venda'}, ${moeda.format(i.valorItem)})` +
  (i.isAluguel ? (i.dataDevolucao ? ` devolvido em ${dataBR(i.dataDevolucao)}` : ` até ${dataBR(i.dataVencimentoAluguel)}`) : '');

function detalhesDo(p: Pedido): Detalhe[] {
  const lista: (Detalhe | false)[] = [
    // Itens largos primeiro, para a grade de 4 colunas não quebrar.
    { rotulo: 'Cliente', valor: `${p.clienteNome}${p.clienteClassificacao ? ` (${p.clienteClassificacao})` : ''}`, largo: true },
    p.itens
      ? { rotulo: 'Itens', valor: p.itens.map(textoItem).join('; '), largo: true }
      : { rotulo: 'Itens', valor: 'O back ainda não devolve os itens do pedido.', largo: true },
    !!p.descricao && { rotulo: 'Descrição', valor: p.descricao, largo: true },
    {
      rotulo: 'Desconto',
      valor:
        ROTULO_STATUS_DESCONTO[p.statusAprovacaoDesconto] +
        (p.descontoSolicitado != null ? ` · solicitado ${percentual(p.descontoSolicitado)}` : '') +
        (p.descontoAutorizado != null ? ` · autorizado ${percentual(p.descontoAutorizado)}` : '') +
        (p.colaboradorDescontoNome ? ` · por ${p.colaboradorDescontoNome}` : ''),
      largo: true,
    },
    !!p.modalidadePagamento && { rotulo: 'Pagamento', valor: ROTULO_PAGAMENTO[p.modalidadePagamento] },
    !!p.itens && { rotulo: 'Subtotal', valor: moeda.format(subtotalDe(p.itens)) },
    { rotulo: 'Total', valor: moeda.format(p.valorTotal) },
    { rotulo: 'Criado em', valor: dataBR(p.dataCriacao) },
    !!p.dataVencimento && { rotulo: 'Vencimento', valor: dataBR(p.dataVencimento) },
    !!p.dataAtualizacaoDesconto && { rotulo: 'Desconto decidido em', valor: dataBR(p.dataAtualizacaoDesconto) },
  ];
  return lista.filter((d): d is Detalhe => !!d);
}

/** Card do pedido: resumo sempre visível; "Ver detalhes" abre a grade com tudo. */
export default function PedidoCard({
  pedido: p,
  clienteInadimplente,
  onFinalizar,
  onDevolver,
  onEditar,
  onExcluir,
}: PedidoCardProps) {
  const [aberto, setAberto] = useState(false);
  const vencido = estaVencido(p);
  const tipo = tipoDoPedido(p.itens);
  const pendente = p.statusPedido === 'PENDENTE';

  const condicao = [
    p.modalidadePagamento ? ROTULO_PAGAMENTO[p.modalidadePagamento] : '',
    p.dataVencimento ? `vence ${dataBR(p.dataVencimento)}` : '',
    p.descontoAutorizado ? `${percentual(p.descontoAutorizado)} de desconto` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="item">
      <div className="item-topo">
        <span className="item-titulo">
          #{p.id}
          {tipo && ` · ${tipo}`} <span className="item-sub">· {dataBR(p.dataCriacao)}</span>
        </span>
        <div className="selos">
          <span className={`selo ${p.statusPedido.toLowerCase()}`}>
            {pendente ? 'Pedido pendente' : ROTULO_STATUS_PEDIDO[p.statusPedido]}
          </span>
          {p.statusAprovacaoDesconto !== 'NAO_SOLICITADO' && (
            <span className={`selo ${CLASSE_STATUS_DESCONTO[p.statusAprovacaoDesconto]}`}>
              {ROTULO_STATUS_DESCONTO[p.statusAprovacaoDesconto]}
            </span>
          )}
          {vencido && <span className="selo vencido">Vencido</span>}
        </div>
      </div>

      <div className="item-linha">
        <strong>{p.clienteNome}</strong>
        {p.clienteClassificacao === 'VIP' && <span className="selo vip">VIP</span>}
        {clienteInadimplente && <span className="selo inadimplente">Inadimplente</span>}
      </div>
      {p.descricao && <p className="item-info">{p.descricao}</p>}
      {p.itens && (
        <p className="item-info">
          {p.itens.map((i) => `${i.quantidade}× ${i.nomeProduto}${i.isAluguel ? ' (aluguel)' : ''}`).join(', ')}
        </p>
      )}
      <div className="item-linha entre">
        <span className="item-info">{condicao}</span>
        <strong className="valor">{moeda.format(p.valorTotal)}</strong>
      </div>

      {aguardaDesconto(p) && pendente && (
        <p className="aviso">
          Desconto{p.descontoSolicitado != null ? ` de ${percentual(p.descontoSolicitado)}` : ''} aguardando a decisão de um
          colaborador: o pedido só pode ser finalizado depois.
        </p>
      )}
      {vencido && <p className="aviso erro">Pedido vencido: só pode ser finalizado (registrar o pagamento).</p>}

      <div className="item-rodape">
        <div className="acoes">
          {pendente && (
            <button
              type="button"
              className="confirmar"
              disabled={!podeFinalizar(p)}
              title={podeFinalizar(p) ? 'Registra o pagamento e marca o pedido como pago' : 'Aguardando a decisão do desconto'}
              onClick={() => onFinalizar(p)}
            >
              Finalizar (pago)
            </button>
          )}
          {podeDevolver(p) && (
            <button type="button" onClick={() => onDevolver(p)}>
              Devolver aluguel
            </button>
          )}
          {podeEditar(p) && (
            <button type="button" className="secundario" onClick={() => onEditar(p)}>
              Editar
            </button>
          )}
          {podeExcluir(p) && (
            <button type="button" className="secundario" onClick={() => onExcluir(p)}>
              Excluir pedido
            </button>
          )}
        </div>
        <button type="button" className="link" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
          {aberto ? 'Ocultar detalhes ▴' : 'Ver detalhes ▾'}
        </button>
      </div>

      {aberto && (
        <dl className="detalhes">
          {detalhesDo(p).map((d) => (
            <div key={d.rotulo} style={{ display: 'contents' }}>
              <dt className={d.largo ? 'inicio' : undefined}>{d.rotulo}</dt>
              <dd className={d.largo ? 'largo' : undefined}>{d.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
