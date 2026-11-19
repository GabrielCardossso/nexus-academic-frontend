import { useCallback, useEffect, useState } from 'react';
import Aviso from '../components/comum/Aviso';
import ConfirmarModal from '../components/comum/ConfirmarModal';
import Modal from '../components/comum/Modal';
import PedidoForm from '../components/pedidos/PedidoForm';
import PedidoCard from '../components/pedidos/PedidoCard';
import { estaInadimplente } from '../regras';
import {
  devolverPedido,
  excluirPedido,
  finalizarPedido,
  listarClientes,
  listarPedidos,
  listarProdutos,
} from '../services/api';
import type { ClienteListarResponse, Pedido, ProdutoListarResponse } from '../types';
import { moeda, type Mensagem } from '../utils';

const listaItens = (p: Pedido) =>
  p.itens ? p.itens.map((i) => `${i.quantidade}× ${i.nomeProduto}${i.isAluguel ? ' (aluguel)' : ''}`).join(', ') : null;

export default function PedidosTela() {
  const [clientes, setClientes] = useState<ClienteListarResponse[]>([]);
  const [produtos, setProdutos] = useState<ProdutoListarResponse[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null); // null = carregando
  const [aviso, setAviso] = useState<Mensagem>(null);

  const [novoAberto, setNovoAberto] = useState(false);
  const [editando, setEditando] = useState<Pedido | null>(null); // pedido no popup de edição
  const [enviandoNovo, setEnviandoNovo] = useState(false);
  const [devolvendo, setDevolvendo] = useState<Pedido | null>(null);
  const [excluindo, setExcluindo] = useState<Pedido | null>(null);
  const [finalizando, setFinalizando] = useState<Pedido | null>(null);
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
  const fecharDevolucao = useCallback(() => setDevolvendo(null), []);
  const fecharExclusao = useCallback(() => setExcluindo(null), []);
  const fecharFinalizacao = useCallback(() => setFinalizando(null), []);

  /** Roda a ação do popup de confirmação, mostra o aviso e recarrega (estoque e crédito mudam). */
  async function confirmar(acao: () => Promise<unknown>, sucesso: string, fechar: () => void) {
    setAviso(null);
    setProcessando(true);
    try {
      await acao();
      setAviso({ tipo: 'sucesso', texto: sucesso });
      await carregar();
    } catch (err) {
      setAviso({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setProcessando(false);
      fechar();
    }
  }

  async function aoSalvar(mensagem: string) {
    setAviso({ tipo: 'sucesso', texto: mensagem });
    fecharNovo();
    await carregar();
  }

  const inadimplente = (p: Pedido) => estaInadimplente({ id: p.clienteId, email: p.clienteEmail }, pedidos ?? []);

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
            clienteInadimplente={inadimplente(p)}
            onFinalizar={setFinalizando}
            onDevolver={setDevolvendo}
            onEditar={setEditando}
            onExcluir={setExcluindo}
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
        aberto={finalizando !== null}
        titulo="Finalizar pedido?"
        textoConfirmar="Finalizar (pago)"
        textoCancelar="Voltar"
        carregando={processando}
        onConfirmar={() =>
          finalizando &&
          confirmar(() => finalizarPedido(finalizando.id), `Pedido #${finalizando.id} finalizado: pagamento registrado.`, fecharFinalizacao)
        }
        onCancelar={fecharFinalizacao}
      >
        {finalizando && (
          <>
            <p>
              <strong>Pedido #{finalizando.id}</strong> — {finalizando.clienteNome} — {moeda.format(finalizando.valorTotal)}
            </p>
            <p>
              O pedido passa para "Pago" e não pode mais ser editado nem excluído.
              {finalizando.modalidadePagamento === 'A_PRAZO' && ' O valor reservado volta para o limite de crédito do cliente.'}
            </p>
          </>
        )}
      </ConfirmarModal>

      <ConfirmarModal
        aberto={devolvendo !== null}
        titulo="Confirmar devolução?"
        textoConfirmar="Confirmar devolução"
        carregando={processando}
        onConfirmar={() =>
          devolvendo &&
          confirmar(() => devolverPedido(devolvendo.id), `Aluguel do pedido #${devolvendo.id} devolvido. Estoque atualizado.`, fecharDevolucao)
        }
        onCancelar={fecharDevolucao}
      >
        {devolvendo && (
          <>
            <p>
              <strong>Pedido #{devolvendo.id}</strong> — {devolvendo.clienteNome}
            </p>
            {devolvendo.itens && (
              <p>
                {devolvendo.itens
                  .filter((i) => i.isAluguel && !i.dataDevolucao)
                  .map((i) => `${i.quantidade}× ${i.nomeProduto}`)
                  .join(', ')}
              </p>
            )}
            <p>
              Todos os itens de aluguel ainda não devolvidos voltam ao estoque. O crédito do cliente não muda. Essa ação não
              pode ser desfeita.
            </p>
          </>
        )}
      </ConfirmarModal>

      <ConfirmarModal
        aberto={excluindo !== null}
        titulo="Excluir pedido?"
        textoConfirmar="Excluir pedido"
        textoCancelar="Voltar"
        carregando={processando}
        onConfirmar={() =>
          excluindo &&
          confirmar(() => excluirPedido(excluindo.id), `Pedido #${excluindo.id} excluído. Estoque devolvido.`, fecharExclusao)
        }
        onCancelar={fecharExclusao}
      >
        {excluindo && (
          <>
            <p>
              <strong>Pedido #{excluindo.id}</strong> — {excluindo.clienteNome}
            </p>
            {listaItens(excluindo) && <p>{listaItens(excluindo)}</p>}
            <p>
              Os itens voltam ao estoque
              {excluindo.modalidadePagamento === 'A_PRAZO' ? ' e o valor reservado volta para o limite do cliente' : ''}. O
              pedido sai da lista. Essa ação não pode ser desfeita.
            </p>
          </>
        )}
      </ConfirmarModal>
    </>
  );
}
