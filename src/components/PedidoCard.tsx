import { useState } from 'react';
import {
  aguardaDesconto,
  estaVencido,
  linhasSolicitacao,
  podeConfirmar,
  podeDevolver,
  podeEditar,
  podePagar,
  resumoPedido,
  ROTULO_PAGAMENTO,
  ROTULO_STATUS_PEDIDO,
  ROTULO_TIPO,
} from '../regras';
import type { Pedido } from '../types';
import { dataBR, dataHoraBR, moeda } from '../utils';

interface PedidoCardProps {
  pedido: Pedido;
  onConfirmar: (p: Pedido) => void;
  onPagar: (p: Pedido) => void;
  onDevolver: (p: Pedido) => void;
  onEditar: (p: Pedido) => void;
}

type Detalhe = { rotulo: string; valor: string; largo?: boolean };

function detalhesDo(p: Pedido): Detalhe[] {
  const r = resumoPedido(p);
  const aluguel = p.tipo === 'ALUGUEL';
  const porMes = aluguel ? '/mês' : '';
  const lista: (Detalhe | false)[] = [
    // Itens largos primeiro, para a grade de 4 colunas não quebrar.
    {
      rotulo: 'Cliente',
      valor: `${p.clienteNome} (${p.clienteCategoria}${p.clienteInadimplente ? ', inadimplente' : ''})`,
      largo: true,
    },
    {
      rotulo: 'Itens',
      valor: p.itens.map((i) => `${i.quantidade}× ${i.nome} (${moeda.format(i.precoUnitario)}${porMes})`).join('; '),
      largo: true,
    },
    !!p.descricao && { rotulo: 'Descrição', valor: p.descricao, largo: true },
    !!p.solicitacao && { rotulo: 'Desconto solicitado', valor: linhasSolicitacao(p.solicitacao).join(' — '), largo: true },
    { rotulo: 'Tipo', valor: `${ROTULO_TIPO[p.tipo]}${aluguel ? ` (${p.meses} ${p.meses === 1 ? 'mês' : 'meses'})` : ''}` },
    { rotulo: 'Pagamento', valor: ROTULO_PAGAMENTO[p.pagamento] },
    { rotulo: 'Subtotal', valor: moeda.format(r.subtotal) },
    { rotulo: 'Desconto', valor: `${r.percentual}% (− ${moeda.format(r.valorDesconto)})` },
    { rotulo: 'Total', valor: moeda.format(r.total) },
    p.pagamento === 'A_PRAZO' && {
      rotulo: 'Crédito usado',
      valor: `${moeda.format(p.creditoUsado ?? r.total)}${p.pagoEm ? ' (devolvido)' : ''}`,
    },
    { rotulo: 'Criado em', valor: dataHoraBR(p.criadoEm) },
    { rotulo: aluguel ? 'Início' : 'Emissão', valor: dataBR(p.emissao) },
    aluguel && { rotulo: 'Fim do aluguel', valor: dataBR(p.fimAluguel ?? p.vencimento) },
    p.pagamento === 'A_PRAZO' && { rotulo: 'Vencimento', valor: dataBR(p.vencimento) },
    !!p.pagoEm && { rotulo: 'Pago em', valor: dataHoraBR(p.pagoEm) },
    !!p.concluidoEm && { rotulo: 'Concluído em', valor: dataHoraBR(p.concluidoEm) },
    !!p.devolvidoEm && { rotulo: 'Devolvido em', valor: dataHoraBR(p.devolvidoEm) },
  ];
  return lista.filter((d): d is Detalhe => !!d);
}

/** Card do pedido: resumo sempre visível; "Ver detalhes" abre a grade com tudo. */
export default function PedidoCard({ pedido: p, onConfirmar, onPagar, onDevolver, onEditar }: PedidoCardProps) {
  const [aberto, setAberto] = useState(false);
  const r = resumoPedido(p);
  const aluguel = p.tipo === 'ALUGUEL';
  const vencido = estaVencido(p);
  const mostrarConfirmar = podeConfirmar(p) || aguardaDesconto(p);

  const condicao = [
    ROTULO_PAGAMENTO[p.pagamento],
    p.pagamento === 'A_PRAZO' ? `vence ${dataBR(p.vencimento)}` : '',
    aluguel ? `aluguel até ${dataBR(p.fimAluguel ?? p.vencimento)}` : '',
    r.percentual > 0 ? `${r.percentual}% de desconto` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="item">
      <div className="item-topo">
        <span className="item-titulo">
          #{p.id} · {ROTULO_TIPO[p.tipo]}
          {aluguel && ` (${p.meses} ${p.meses === 1 ? 'mês' : 'meses'})`}{' '}
          <span className="item-sub">· {dataBR(p.criadoEm)}</span>
        </span>
        <div className="selos">
          <span className={`selo ${r.statusPedido.toLowerCase()}`}>
            {r.statusPedido === 'PENDENTE' ? 'Pedido pendente' : ROTULO_STATUS_PEDIDO[r.statusPedido]}
          </span>
          <span className={`selo ${r.statusPagamento.toLowerCase()}`}>
            {r.statusPagamento === 'PAGO' ? 'Pago' : 'Pagamento pendente'}
          </span>
          {vencido && <span className="selo vencido">Vencido</span>}
        </div>
      </div>

      <div className="item-linha">
        <strong>{p.clienteNome}</strong>
        {p.clienteCategoria === 'VIP' && <span className="selo vip">VIP</span>}
        {p.clienteInadimplente && <span className="selo inadimplente">Inadimplente</span>}
      </div>
      {p.descricao && <p className="item-info">{p.descricao}</p>}
      <p className="item-info">{p.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(', ')}</p>
      <div className="item-linha entre">
        <span className="item-info">{condicao}</span>
        <strong className="valor">{moeda.format(r.total)}</strong>
      </div>

      {aguardaDesconto(p) && (
        <p className="aviso">Desconto de {p.solicitacao!.percentual}% aguardando aprovação de um colaborador.</p>
      )}

      <div className="item-rodape">
        <div className="acoes">
          {mostrarConfirmar && (
            <button
              type="button"
              className="confirmar"
              disabled={!podeConfirmar(p)}
              title={podeConfirmar(p) ? undefined : 'Aguardando aprovação do desconto'}
              onClick={() => onConfirmar(p)}
            >
              Confirmar pedido
            </button>
          )}
          {podePagar(p) && (
            <button type="button" className="confirmar" onClick={() => onPagar(p)}>
              Registrar pagamento
            </button>
          )}
          {podeDevolver(p) && (
            <button type="button" onClick={() => onDevolver(p)}>
              Devolver
            </button>
          )}
          {podeEditar(p) && (
            <button type="button" className="secundario" onClick={() => onEditar(p)}>
              Editar
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
