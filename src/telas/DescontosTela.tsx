import { useCallback, useEffect, useState } from 'react';
import Aviso from '../components/Aviso';
import { decidirDesconto, listarColaboradores, listarPedidos } from '../services/api';
import { mensagemRejeicao, resumoPedido, ROTULO_PAGAMENTO, ROTULO_TIPO } from '../regras';
import type { Colaborador, Pedido } from '../types';
import { contem, dataBR, moeda, type Mensagem } from '../utils';

type Aba = 'PENDENTES' | 'DECIDIDAS';

interface DescontosTelaProps {
  /** Avisa o App quando muda a quantidade de pendentes (contador do menu). */
  onPendentesMudou?: () => void;
}

export default function DescontosTela({ onPendentesMudou }: DescontosTelaProps) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [colaboradorId, setColaboradorId] = useState('');
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null); // null = carregando
  const [aba, setAba] = useState<Aba>('PENDENTES');
  const [busca, setBusca] = useState('');
  const [aviso, setAviso] = useState<Mensagem>(null);
  const [decidindo, setDecidindo] = useState<number | null>(null); // id do pedido em decisão

  async function carregar() {
    try {
      const [c, p] = await Promise.all([listarColaboradores(), listarPedidos()]);
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
  const comSolicitacao = (pedidos ?? []).filter((p) => p.solicitacao && contem(busca, `#${p.id}`, p.clienteNome));
  const pendentes = comSolicitacao.filter((p) => p.solicitacao!.status === 'PENDENTE');
  const decididas = comSolicitacao.filter((p) => p.solicitacao!.status !== 'PENDENTE');
  const lista = aba === 'PENDENTES' ? pendentes : decididas;

  async function decidir(pedido: Pedido, aprovar: boolean) {
    if (!colaborador) return;
    setAviso(null);
    setDecidindo(pedido.id);
    try {
      const atualizado = await decidirDesconto(pedido.id, aprovar, colaborador.id);
      const s = atualizado.solicitacao!;
      setAviso(
        aprovar
          ? { tipo: 'sucesso', texto: `Desconto de ${s.percentual}% do pedido #${pedido.id} aprovado por ${s.colaboradorNome}.` }
          : { tipo: 'sucesso', texto: mensagemRejeicao(s) },
      );
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
          <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} disabled={colaboradores.length === 0}>
            {colaboradores.length === 0 && <option value="">Nenhum colaborador</option>}
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} (ID {c.id})
              </option>
            ))}
          </select>
        </label>
      </div>

      <Aviso msg={aviso} onFechar={fecharAviso} />

      {pedidos && colaboradores.length === 0 && (
        <p className="aviso erro">Cadastre um colaborador (Gestão &gt; Colaboradores) para poder decidir os descontos.</p>
      )}

      <div className="abas" role="tablist">
        <button type="button" role="tab" aria-selected={aba === 'PENDENTES'} onClick={() => setAba('PENDENTES')}>
          Pendentes ({pendentes.length})
        </button>
        <button type="button" role="tab" aria-selected={aba === 'DECIDIDAS'} onClick={() => setAba('DECIDIDAS')}>
          Decididas ({decididas.length})
        </button>
      </div>

      <div className="filtros">
        <input
          type="search"
          placeholder="Buscar por nº do pedido ou cliente"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar solicitações"
        />
      </div>

      {pedidos === null && <p className="vazio">Carregando solicitações...</p>}
      {pedidos && lista.length === 0 && (
        <p className="vazio">
          {aba === 'PENDENTES' ? 'Nenhuma solicitação aguardando decisão.' : 'Nenhuma solicitação decidida ainda.'}
        </p>
      )}

      <ul className="itens">
        {lista.map((p) => {
          const s = p.solicitacao!;
          const atual = resumoPedido({ ...p, solicitacao: { ...s, status: 'REJEITADA' } }); // sem a solicitação
          const comDesconto = resumoPedido({ ...p, solicitacao: { ...s, status: 'APROVADA' } });
          return (
            <li key={p.id} className="item">
              <div className="item-topo">
                <span className="item-titulo">
                  #{p.id} · {ROTULO_TIPO[p.tipo]} <span className="item-sub">· {dataBR(p.criadoEm)}</span>
                </span>
                {s.status === 'PENDENTE' && <span className="selo pendente">Aguardando decisão</span>}
                {s.status === 'APROVADA' && <span className="selo aprovada">Aprovada</span>}
                {s.status === 'REJEITADA' && <span className="selo rejeitada">Rejeitada</span>}
              </div>

              <div className="item-linha">
                <strong>{p.clienteNome}</strong>
                {p.clienteCategoria === 'VIP' && <span className="selo vip">VIP</span>}
                {p.clienteInadimplente && <span className="selo inadimplente">Inadimplente</span>}
              </div>
              <p className="item-info">{p.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(', ')}</p>

              <div className="item-linha entre">
                <span className="item-info">
                  Solicitou <strong>{s.percentual}%</strong> · {ROTULO_PAGAMENTO[p.pagamento]}
                </span>
                <span className="item-info">
                  {moeda.format(atual.total)} → <strong className="valor">{moeda.format(comDesconto.total)}</strong>
                </span>
              </div>

              {s.status === 'PENDENTE' ? (
                <div className="item-rodape fim">
                  <div className="acoes">
                    <button
                      type="button"
                      className="rejeitar"
                      disabled={!colaborador || decidindo === p.id}
                      onClick={() => decidir(p, false)}
                    >
                      Rejeitar
                    </button>
                    <button
                      type="button"
                      className="confirmar"
                      disabled={!colaborador || decidindo === p.id}
                      onClick={() => decidir(p, true)}
                    >
                      Aprovar {s.percentual}%
                    </button>
                  </div>
                </div>
              ) : (
                <p className="item-info">
                  {s.status === 'APROVADA' ? 'Aprovada' : 'Rejeitada'} por {s.colaboradorNome} (ID {s.colaboradorId})
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
