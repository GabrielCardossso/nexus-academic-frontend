import { useCallback, useEffect, useState } from 'react';
import Aviso from '../components/comum/Aviso';
import Selecao from '../components/comum/Selecao';
import { listarClientes, listarColaboradores, listarPedidos, resolverDesconto } from '../services/api';
import {
  DESCONTO_VIP,
  decididoPorColaborador,
  estaInadimplente,
  MSG_INADIMPLENTE_NAO_APROVA,
  percentual,
  ROTULO_PAGAMENTO,
  ROTULO_STATUS_DESCONTO,
  subtotalDe,
  tipoDoPedido,
  totalComDesconto,
  valorParaLimite,
} from '../regras';
import type { ClienteListarResponse, Colaborador, DecisaoDesconto, Pedido } from '../types';
import { dataBR, moeda, type Mensagem } from '../utils';

type Aba = 'PENDENTES' | 'DECIDIDAS';

interface DescontosTelaProps {
  /** Avisa o App quando muda a quantidade de pendentes (contador do menu). */
  onPendentesMudou?: () => void;
}

/**
 * Total se aprovar e se reprovar (só dá para calcular quando os itens vêm na resposta), e o quanto o
 * pedido segura hoje no limite (com desconto pendente, o valor com o desconto pedido: valorParaLimite).
 */
function previsoes(p: Pedido): { aprovar: number; reprovar: number; reservado: number } | null {
  if (!p.itens || p.descontoSolicitado == null || p.descontoAutorizado == null) return null;
  const subtotal = subtotalDe(p.itens);
  const reprovado = p.clienteClassificacao === 'VIP' ? DESCONTO_VIP : p.descontoAutorizado;
  return {
    aprovar: totalComDesconto(subtotal, p.descontoSolicitado),
    reprovar: totalComDesconto(subtotal, reprovado),
    reservado: valorParaLimite(subtotal, {
      descontoSolicitado: p.descontoSolicitado,
      descontoAutorizado: p.descontoAutorizado,
      statusAprovacaoDesconto: p.statusAprovacaoDesconto,
    }),
  };
}

export default function DescontosTela({ onPendentesMudou }: DescontosTelaProps) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [colaboradorId, setColaboradorId] = useState('');
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null); // null = carregando
  const [clientes, setClientes] = useState<ClienteListarResponse[]>([]); // para o aviso de limite na reprovação
  const [aba, setAba] = useState<Aba>('PENDENTES');
  const [aviso, setAviso] = useState<Mensagem>(null);
  const [decidindo, setDecidindo] = useState<number | null>(null); // id do pedido em decisão

  async function carregar() {
    try {
      const [todos, p, cl] = await Promise.all([listarColaboradores(), listarPedidos(), listarClientes().catch(() => [])]);
      setClientes(cl);
      const c = todos.filter((x) => x.ativo !== false); // desativado não decide descontos (o back responde "não existe")
      setColaboradores(c);
      setPedidos(p);
      setColaboradorId((atual) => (c.some((x) => String(x.id) === atual) ? atual : String(c[0]?.id ?? '')));
    } catch (err) {
      setAviso({ tipo: 'erro', texto: (err as Error).message });
      setPedidos([]);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const fecharAviso = useCallback(() => setAviso(null), []);

  const colaborador = colaboradores.find((c) => String(c.id) === colaboradorId);
  // Iguais ao GET /pedidos/solicitacoesDescontoEmAberto: pedido pendente com desconto pendente.
  const pendentes = (pedidos ?? []).filter((p) => p.statusPedido === 'PENDENTE' && p.statusAprovacaoDesconto === 'PENDENTE');
  // Histórico: decididas por um colaborador e as reprovadas por inadimplência.
  const decididas = (pedidos ?? []).filter(
    (p) => decididoPorColaborador(p.statusAprovacaoDesconto) || p.statusAprovacaoDesconto === 'REPROVADO_INADIPLENCIA',
  );
  const lista = aba === 'PENDENTES' ? pendentes : decididas;
  const inadimplente = (p: Pedido) => estaInadimplente({ id: p.clienteId, email: p.clienteEmail }, pedidos ?? []);

  async function decidir(pedido: Pedido, decisao: DecisaoDesconto) {
    if (!colaborador) return;
    setAviso(null);
    setDecidindo(pedido.id);
    try {
      await resolverDesconto(pedido.id, colaborador.id, decisao);
      setAviso({
        tipo: 'sucesso',
        texto: `Desconto do pedido #${pedido.id} ${decisao === 'APROVADO' ? 'aprovado' : 'reprovado'} por ${colaborador.nome}.`,
      });
      await carregar();
      onPendentesMudou?.();
    } catch (err) {
      setAviso({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setDecidindo(null);
    }
  }

  return (
    <>
      <div className="topo">
        <h1>Descontos</h1>
        <label className="campo aprovando">
          <span>Aprovando como</span>
          <Selecao
            value={colaboradorId}
            onChange={setColaboradorId}
            disabled={colaboradores.length === 0}
            placeholder="Nenhum colaborador"
            opcoes={colaboradores.map((c) => ({ valor: String(c.id), rotulo: c.nome, detalhe: `ID ${c.id}` }))}
          />
        </label>
      </div>

      <Aviso msg={aviso} onFechar={fecharAviso} />

      {pedidos && colaboradores.length === 0 && (
        <p className="aviso erro">
          Cadastre ou reative um colaborador (Gestão &gt; Colaboradores) para poder decidir os descontos.
        </p>
      )}

      <div className="abas" role="tablist">
        <button type="button" role="tab" aria-selected={aba === 'PENDENTES'} onClick={() => setAba('PENDENTES')}>
          Pendentes ({pendentes.length})
        </button>
        <button type="button" role="tab" aria-selected={aba === 'DECIDIDAS'} onClick={() => setAba('DECIDIDAS')}>
          Decididas ({decididas.length})
        </button>
      </div>

      {pedidos === null && <p className="vazio">Carregando solicitações...</p>}
      {pedidos && lista.length === 0 && (
        <p className="vazio">
          {aba === 'PENDENTES' ? 'Nenhuma solicitação aguardando decisão.' : 'Nenhuma solicitação decidida ainda.'}
        </p>
      )}

      <ul className="itens">
        {lista.map((p) => {
          const aguardando = p.statusAprovacaoDesconto === 'PENDENTE';
          const devendo = inadimplente(p);
          const prev = previsoes(p);
          const tipo = tipoDoPedido(p.itens);
          // A prazo: reprovando, o limite passa a segurar o total reprovado no lugar do que segura hoje.
          const limiteAtual = clientes.find((c) => c.id === p.clienteId)?.limiteCredito;
          const limiteSeReprovar =
            aguardando && prev && limiteAtual !== undefined && p.modalidadePagamento === 'A_PRAZO'
              ? limiteAtual + prev.reservado - prev.reprovar
              : null;
          return (
            <li key={p.id} className="item">
              <div className="item-topo">
                <span className="item-titulo">
                  #{p.id}
                  {tipo && ` · ${tipo}`} <span className="item-sub">· {dataBR(p.dataCriacao)}</span>
                </span>
                {aguardando ? (
                  <span className="selo pendente">Aguardando decisão</span>
                ) : (
                  <span className={`selo ${p.statusAprovacaoDesconto === 'APROVADO' ? 'aprovada' : 'rejeitada'}`}>
                    {ROTULO_STATUS_DESCONTO[p.statusAprovacaoDesconto]}
                  </span>
                )}
              </div>

              <div className="item-linha">
                <strong>{p.clienteNome}</strong>
                {p.clienteClassificacao === 'VIP' && <span className="selo vip">VIP</span>}
                {devendo && <span className="selo inadimplente">Inadimplente</span>}
              </div>
              {p.itens && <p className="item-info">{p.itens.map((i) => `${i.quantidade}× ${i.nomeProduto}`).join(', ')}</p>}

              <div className="item-linha entre">
                <span className="item-info">
                  {p.descontoSolicitado != null && (
                    <>
                      Solicitou <strong>{percentual(p.descontoSolicitado)}</strong>
                    </>
                  )}
                  {p.modalidadePagamento && ` · ${ROTULO_PAGAMENTO[p.modalidadePagamento]}`}
                </span>
                <span className="item-info">
                  {aguardando && prev ? (
                    <>
                      Aprovando: <strong className="valor">{moeda.format(prev.aprovar)}</strong> · Reprovando:{' '}
                      {moeda.format(prev.reprovar)}
                    </>
                  ) : (
                    <strong className="valor">{moeda.format(p.valorTotal)}</strong>
                  )}
                </span>
              </div>

              {aguardando && p.clienteClassificacao === 'VIP' && (
                <p className="dica">Cliente VIP: se reprovar, o pedido fica com os 5% automáticos.</p>
              )}
              {limiteSeReprovar !== null && limiteSeReprovar < 0 && (
                <p className="aviso">
                  Reprovando, o total vai para {moeda.format(prev!.reprovar)} e o limite de crédito do cliente fica negativo
                  ({moeda.format(limiteSeReprovar)}): até pagar, ele não consegue fazer outro pedido a prazo nem editar os pedidos a prazo pendentes.
                </p>
              )}
              {/* TRAVA DO FRONT: o back aceita aprovar mesmo se o cliente virou inadimplente depois de pedir. */}
              {aguardando && devendo && <p className="aviso erro">{MSG_INADIMPLENTE_NAO_APROVA}</p>}
              {aguardando ? (
                <div className="item-rodape fim">
                  <div className="acoes">
                    <button
                      type="button"
                      className="rejeitar"
                      disabled={!colaborador || decidindo === p.id}
                      onClick={() => decidir(p, 'REPROVADO')}
                    >
                      Reprovar
                    </button>
                    <button
                      type="button"
                      className="confirmar"
                      disabled={!colaborador || decidindo === p.id || devendo}
                      onClick={() => decidir(p, 'APROVADO')}
                    >
                      Aprovar{p.descontoSolicitado != null ? ` ${percentual(p.descontoSolicitado)}` : ''}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="item-info">
                  {p.statusAprovacaoDesconto === 'REPROVADO_INADIPLENCIA'
                    ? 'Reprovado automaticamente: o cliente estava inadimplente quando o pedido foi feito.'
                    : `${p.statusAprovacaoDesconto === 'APROVADO' ? 'Aprovado' : 'Reprovado'} por ${p.colaboradorDescontoNome ?? '—'}${
                        p.dataAtualizacaoDesconto ? ` em ${dataBR(p.dataAtualizacaoDesconto)}` : ''
                      }`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
