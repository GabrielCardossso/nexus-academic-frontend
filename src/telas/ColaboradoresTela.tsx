import { useEffect, useState } from 'react';
import { decidirDesconto, listarColaboradores, listarPedidos } from '../services/api';
import { linhasSolicitacao, mensagemRejeicao, resumoPedido, ROTULO_TIPO } from '../regras';
import type { Colaborador, Pedido } from '../types';
import { moeda, type Mensagem } from '../utils';

export default function ColaboradoresTela() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [colaboradorId, setColaboradorId] = useState('');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [msg, setMsg] = useState<Mensagem>(null);

  async function carregar() {
    try {
      const [c, p] = await Promise.all([listarColaboradores(), listarPedidos()]);
      setColaboradores(c);
      setPedidos(p);
      setColaboradorId((atual) => atual || String(c[0]?.id ?? ''));
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const colaborador = colaboradores.find((c) => String(c.id) === colaboradorId);
  const pendentes = pedidos.filter((p) => p.solicitacao?.status === 'PENDENTE');
  const decididas = pedidos.filter((p) => p.solicitacao && p.solicitacao.status !== 'PENDENTE');

  async function decidir(pedido: Pedido, aprovar: boolean) {
    if (!colaborador) return;
    setMsg(null);
    try {
      const atualizado = await decidirDesconto(pedido.id, aprovar, colaborador.id);
      const s = atualizado.solicitacao!;
      setMsg(
        aprovar
          ? {
              tipo: 'sucesso',
              texto: `Desconto de ${s.percentual}% do pedido #${pedido.id} aprovado por ${s.colaboradorNome} (ID ${s.colaboradorId}).`,
            }
          : { tipo: 'erro', texto: mensagemRejeicao(s) },
      );
      await carregar();
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    }
  }

  return (
    <>
      <h1>Colaboradores</h1>
      <div className="tela">
        <section className="card largura-total">
          <h2>Colaborador atual</h2>
          <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} (ID {c.id})
              </option>
            ))}
          </select>
          {msg && <p className={`msg ${msg.tipo}`}>{msg.texto}</p>}
        </section>

        <section className="card">
          <h2>Solicitações pendentes</h2>
          {pendentes.length === 0 && <p className="vazio">Nenhuma solicitação pendente.</p>}
          {pendentes.length > 0 && (
            <ul className="lista alta">
              {pendentes.map((p) => {
                const s = p.solicitacao!;
                const comDesconto = resumoPedido({ ...p, solicitacao: { ...s, status: 'APROVADA' } });
                return (
                  <li key={p.id}>
                    <strong>
                      Pedido #{p.id} — {p.clienteNome}
                    </strong>
                    <span>Tipo: {ROTULO_TIPO[p.tipo]}</span>
                    <span>Desconto solicitado: {s.percentual}%</span>
                    <span>Subtotal: {moeda.format(comDesconto.subtotal)}</span>
                    <span>Total com desconto: {moeda.format(comDesconto.total)}</span>
                    <div className="acoes">
                      <button type="button" disabled={!colaborador} onClick={() => decidir(p, true)}>
                        Aprovar
                      </button>
                      <button type="button" className="rejeitar" disabled={!colaborador} onClick={() => decidir(p, false)}>
                        Rejeitar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Solicitações decididas</h2>
          {decididas.length === 0 && <p className="vazio">Nenhuma solicitação decidida ainda.</p>}
          {decididas.length > 0 && (
            <ul className="lista alta">
              {decididas.map((p) => (
                <li key={p.id}>
                  <strong>
                    Pedido #{p.id} — {p.clienteNome}
                  </strong>
                  {linhasSolicitacao(p.solicitacao!).map((linha, i) => (
                    <span key={i}>{linha}</span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
