import { useCallback, useEffect, useState } from 'react';
import Aviso from '../components/comum/Aviso';
import ConfirmarModal from '../components/comum/ConfirmarModal';
import Modal from '../components/comum/Modal';
import PedidoForm from '../components/pedidos/PedidoForm';
import PedidoCard from '../components/pedidos/PedidoCard';
import {
  cancelarPedido,
  confirmarPedido,
  devolverPedido,
  listarClientes,
  listarPedidos,
  listarProdutos,
  pagarPedido,
} from '../services/api';
import type { ClienteListarResponse, Pedido, ProdutoListarResponse } from '../types';
import { moeda, type Mensagem } from '../utils';

export default function PedidosTela() {
  const [clientes, setClientes] = useState<ClienteListarResponse[]>([]);
  const [produtos, setProdutos] = useState<ProdutoListarResponse[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null); // null = carregando
  const [aviso, setAviso] = useState<Mensagem>(null);

  const [novoAberto, setNovoAberto] = useState(false);
  const [editando, setEditando] = useState<Pedido | null>(null); // pedido no popup de edição
  const [enviandoNovo, setEnviandoNovo] = useState(false);
  const [devolvendo, setDevolvendo] = useState<Pedido | null>(null); // pedido no popup de devolução
  const [cancelando, setCancelando] = useState<Pedido | null>(null); // pedido no popup de cancelamento
  const [processando, setProcessando] = useState(false);

  async function carregar() {
    try {
      const [c, p, ped] = await Promise.all([listarClientes(), listarProdutos(), listarPedidos()]);
      setClientes(c);
      setProdutos(p);
      setPedidos(ped);
    } catch (err) {
      setAviso({ tipo: 'erro', texto: (err as Error).message });
      setPedidos([]);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const fecharAviso = useCallback(() => setAviso(null), []);
  const fecharNovo = useCallback(() => {
    setNovoAberto(false);
    setEditando(null);
  }, []);
  const cancelarDevolucao = useCallback(() => setDevolvendo(null), []);
  const fecharCancelamento = useCallback(() => setCancelando(null), []);

  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    setAviso(null);
    try {
      await acao();
      setAviso({ tipo: 'sucesso', texto: sucesso });
      await carregar();
    } catch (err) {
      setAviso({ tipo: 'erro', texto: (err as Error).message });
    }
  }

  async function aoSalvar(pedido: Pedido) {
    setAviso({ tipo: 'sucesso', texto: editando ? `Pedido #${pedido.id} atualizado!` : `Pedido #${pedido.id} realizado!` });
    fecharNovo();
    await carregar(); // estoque e crédito mudaram e o pedido entra (ou muda) na lista
  }

  async function confirmarDevolucao() {
    if (!devolvendo) return;
    setProcessando(true);
    await executar(() => devolverPedido(devolvendo.id), `Aluguel #${devolvendo.id} devolvido. Estoque atualizado.`);
    setProcessando(false);
    setDevolvendo(null);
  }

  async function confirmarCancelamento() {
    if (!cancelando) return;
    setProcessando(true);
    await executar(
      () => cancelarPedido(cancelando.id),
      `Pedido #${cancelando.id} cancelado. Estoque${cancelando.creditoUsado ? ' e crédito' : ''} devolvido${cancelando.creditoUsado ? 's' : ''}.`,
    );
    setProcessando(false);
    setCancelando(null);
  }

  return (
    <>
      <div className="topo">
        <h1>Pedidos</h1>
        <button type="button" onClick={() => setNovoAberto(true)}>
          + Novo pedido
        </button>
      </div>

      <Aviso msg={aviso} onFechar={fecharAviso} />

      {pedidos === null && <p className="vazio">Carregando pedidos...</p>}
      {pedidos && pedidos.length > 0 && (
        <p className="contagem">
          {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
        </p>
      )}
      {pedidos && pedidos.length === 0 && <p className="vazio">Nenhum pedido ainda.</p>}

      <ul className="itens">
        {(pedidos ?? []).map((p) => (
          <PedidoCard
            key={p.id}
            pedido={p}
            onConfirmar={(x) => executar(() => confirmarPedido(x.id), `Pedido #${x.id} confirmado e concluído.`)}
            onPagar={(x) =>
              executar(
                () => pagarPedido(x.id),
                `Pagamento do pedido #${x.id} registrado. ${moeda.format(x.creditoUsado ?? 0)} voltaram ao limite de crédito.`,
              )
            }
            onDevolver={setDevolvendo}
            onEditar={setEditando}
            onCancelar={setCancelando}
          />
        ))}
      </ul>

      <Modal
        aberto={novoAberto || editando !== null}
        titulo={editando ? `Editar pedido #${editando.id}` : 'Novo pedido'}
        onFechar={fecharNovo}
        bloqueado={enviandoNovo}
        larga
      >
        <PedidoForm
          key={editando?.id ?? 'novo'}
          clientes={clientes}
          produtos={produtos}
          pedido={editando ?? undefined}
          onSalvo={aoSalvar}
          onCancelar={fecharNovo}
          onEnviando={setEnviandoNovo}
        />
      </Modal>

      <ConfirmarModal
        aberto={devolvendo !== null}
        titulo="Confirmar devolução?"
        textoConfirmar="Confirmar devolução"
        carregando={processando}
        onConfirmar={confirmarDevolucao}
        onCancelar={cancelarDevolucao}
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

      <ConfirmarModal
        aberto={cancelando !== null}
        titulo="Cancelar pedido?"
        textoConfirmar="Cancelar pedido"
        textoCancelar="Voltar"
        carregando={processando}
        onConfirmar={confirmarCancelamento}
        onCancelar={fecharCancelamento}
      >
        {cancelando && (
          <>
            <p>
              <strong>Pedido #{cancelando.id}</strong> — {cancelando.clienteNome}
            </p>
            <p>{cancelando.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(', ')}</p>
            <p>
              Os itens voltam ao estoque
              {cancelando.creditoUsado ? ' e o crédito reservado volta para o limite do cliente' : ''}. O pedido
              continua na lista como "Cancelado". Essa ação não pode ser desfeita.
            </p>
          </>
        )}
      </ConfirmarModal>
    </>
  );
}
