import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Aviso from '../components/Aviso';
import ConfirmarModal from '../components/ConfirmarModal';
import Modal from '../components/Modal';
import Selecao from '../components/Selecao';
import { cadastrarProduto, editarProduto, listarProdutos, reporEstoque } from '../services/api';
import type { ProdutoListarResponse, ProdutoStatus } from '../types';
import { campo, moeda, type Mensagem } from '../utils';

// Sem status: o back não recebe no cadastro (produto novo entra como disponível).
const FORM_VAZIO = {
  nome: '',
  descricao: '',
  estoque: '',
  precoVenda: '',
  precoAluguel: '',
};

const ROTULO_STATUS: Record<ProdutoStatus, string> = {
  DISPONIVEL: 'Disponível',
  INDISPONIVEL: 'Indisponível',
  DESATIVADO: 'Desativado',
};

/** Dados de um produto que vão para o PUT (o estoque fica de fora: só muda por reposição e pedidos). */
const dadosDe = (p: ProdutoListarResponse, status: ProdutoStatus = p.status) => ({
  nome: p.nome,
  descricao: p.descricao ?? '',
  precoVenda: Number(p.precoVenda),
  precoAluguel: Number(p.precoAluguel),
  status,
});

export default function ProdutosTela() {
  const [produtos, setProdutos] = useState<ProdutoListarResponse[] | null>(null); // null = carregando
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Mensagem>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<ProdutoListarResponse | null>(null); // null = cadastro novo
  const [form, setForm] = useState(FORM_VAZIO);
  const [status, setStatus] = useState<ProdutoStatus>('DISPONIVEL'); // só na edição
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [repondo, setRepondo] = useState<ProdutoListarResponse | null>(null); // popup de reposição
  const [quantidade, setQuantidade] = useState('');
  const [erroRepor, setErroRepor] = useState<string | null>(null);

  const [desativando, setDesativando] = useState<ProdutoListarResponse | null>(null);
  const [processando, setProcessando] = useState(false);

  const onChange = campo(setForm);

  async function carregar() {
    setErroLista(null);
    try {
      setProdutos(await listarProdutos());
    } catch (err) {
      setErroLista((err as Error).message);
      setProdutos([]);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirNovo() {
    setForm(FORM_VAZIO);
    setEditando(null);
    setErroForm(null);
    setFormAberto(true);
  }

  function abrirEditar(p: ProdutoListarResponse) {
    setForm({
      nome: p.nome,
      descricao: p.descricao ?? '',
      estoque: String(p.estoque),
      precoVenda: String(p.precoVenda),
      precoAluguel: String(p.precoAluguel),
    });
    setStatus(p.status);
    setEditando(p);
    setErroForm(null);
    setFormAberto(true);
  }

  function abrirRepor(p: ProdutoListarResponse) {
    setQuantidade('');
    setErroRepor(null);
    setRepondo(p);
  }

  const fecharForm = useCallback(() => setFormAberto(false), []);
  const fecharRepor = useCallback(() => setRepondo(null), []);
  const fecharAviso = useCallback(() => setAviso(null), []);
  const cancelarDesativar = useCallback(() => setDesativando(null), []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErroForm(null);
    try {
      const precos = { precoVenda: Number(form.precoVenda), precoAluguel: Number(form.precoAluguel) };
      if (editando) {
        await editarProduto(editando.id, { nome: form.nome, descricao: form.descricao, ...precos, status });
      } else {
        await cadastrarProduto({ ...form, ...precos, estoque: Number(form.estoque) });
      }
      setAviso({ tipo: 'sucesso', texto: `Produto "${form.nome.trim()}" ${editando ? 'atualizado' : 'cadastrado'}!` });
      setFormAberto(false);
      await carregar();
    } catch (err) {
      setErroForm((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function handleRepor(e: FormEvent) {
    e.preventDefault();
    if (!repondo) return;
    const qtd = Number(quantidade);
    if (!Number.isInteger(qtd) || qtd <= 0) return setErroRepor('Informe uma quantidade inteira maior que zero.');
    setEnviando(true);
    setErroRepor(null);
    try {
      const atualizado = await reporEstoque(repondo.id, qtd);
      setAviso({
        tipo: 'sucesso',
        texto: `Estoque de "${atualizado.nome}" reposto: +${qtd} (agora ${atualizado.estoque}).`,
      });
      setRepondo(null);
      await carregar();
    } catch (err) {
      setErroRepor((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function mudarStatus(p: ProdutoListarResponse, novo: ProdutoStatus) {
    setAviso(null);
    setProcessando(true);
    try {
      await editarProduto(p.id, dadosDe(p, novo));
      setAviso({ tipo: 'sucesso', texto: `Produto "${p.nome}" ${novo === 'DESATIVADO' ? 'desativado' : 'reativado'}.` });
      await carregar();
    } catch (err) {
      setAviso({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setProcessando(false);
      setDesativando(null);
    }
  }

  return (
    <>
      <div className="topo">
        <h1>Produtos</h1>
        <button type="button" onClick={abrirNovo}>
          + Novo produto
        </button>
      </div>

      <Aviso msg={aviso} onFechar={fecharAviso} />

      {erroLista && <p className="msg erro">{erroLista}</p>}
      {produtos === null && <p className="vazio">Carregando produtos...</p>}
      {produtos && produtos.length > 0 && (
        <p className="contagem">
          {produtos.length} {produtos.length === 1 ? 'produto' : 'produtos'}
        </p>
      )}
      {produtos && produtos.length === 0 && <p className="vazio">Nenhum produto cadastrado ainda.</p>}

      <ul className="itens">
        {(produtos ?? []).map((p) => {
          const desativado = p.status === 'DESATIVADO';
          return (
            <li key={p.id} className={`item ${desativado ? 'inativo' : ''}`}>
              <div className="item-topo">
                <span className="item-titulo">{p.nome}</span>
                <span className={`selo ${p.status.toLowerCase()}`}>{ROTULO_STATUS[p.status]}</span>
              </div>
              {p.descricao && <p className="item-info">{p.descricao}</p>}
              <p className="item-info">
                Estoque: {p.estoque} · Venda: {moeda.format(Number(p.precoVenda))} · Aluguel:{' '}
                {moeda.format(Number(p.precoAluguel))}/mês
              </p>
              <div className="acoes">
                <button type="button" className="confirmar" onClick={() => abrirRepor(p)}>
                  Repor estoque
                </button>
                <button type="button" className="secundario" onClick={() => abrirEditar(p)}>
                  Editar
                </button>
                {desativado ? (
                  <button
                    type="button"
                    className="secundario"
                    disabled={processando}
                    onClick={() => mudarStatus(p, 'DISPONIVEL')}
                  >
                    Reativar
                  </button>
                ) : (
                  <button type="button" className="secundario" onClick={() => setDesativando(p)}>
                    Desativar
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        aberto={formAberto}
        titulo={editando ? 'Editar produto' : 'Novo produto'}
        onFechar={fecharForm}
        bloqueado={enviando}
      >
        <form className="form" onSubmit={handleSubmit}>
          <div className="form-grade">
            <label className="campo inteiro">
              <span>Nome do produto</span>
              <input name="nome" type="text" value={form.nome} onChange={onChange} required />
            </label>
            <label className="campo inteiro">
              <span>Descrição</span>
              <input name="descricao" type="text" value={form.descricao} onChange={onChange} />
            </label>
            <label className="campo">
              <span>Preço de venda (R$)</span>
              <input name="precoVenda" type="number" value={form.precoVenda} onChange={onChange} min={0} step="0.01" required />
            </label>
            <label className="campo">
              <span>Aluguel por mês (R$)</span>
              <input
                name="precoAluguel"
                type="number"
                value={form.precoAluguel}
                onChange={onChange}
                min={0}
                step="0.01"
                required
              />
            </label>
            {editando ? (
              <label className="campo">
                <span>Status</span>
                <Selecao<ProdutoStatus>
                  value={status}
                  onChange={setStatus}
                  // Desativar só pelo botão "Desativar", que pede confirmação. Se o produto já está
                  // desativado, a opção aparece para manter o status atual.
                  opcoes={[
                    { valor: 'DISPONIVEL', rotulo: 'Disponível' },
                    { valor: 'INDISPONIVEL', rotulo: 'Indisponível' },
                    ...(editando.status === 'DESATIVADO'
                      ? [{ valor: 'DESATIVADO' as ProdutoStatus, rotulo: 'Desativado' }]
                      : []),
                  ]}
                />
              </label>
            ) : (
              <label className="campo">
                <span>Estoque</span>
                <input name="estoque" type="number" value={form.estoque} onChange={onChange} min={0} step={1} required />
              </label>
            )}
          </div>
          <p className="dica">
            {editando
              ? `Estoque atual: ${editando.estoque}. Para aumentar, use "Repor estoque"; para desativar, use o botão "Desativar". Pedidos já feitos mantêm o preço do momento do pedido.`
              : 'O produto novo entra como disponível.'}
          </p>
          {erroForm && <p className="msg erro">{erroForm}</p>}
          <div className="modal-acoes">
            <button type="button" className="secundario" onClick={fecharForm} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" disabled={enviando}>
              {enviando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal aberto={repondo !== null} titulo="Repor estoque" onFechar={fecharRepor} bloqueado={enviando}>
        {repondo && (
          <form className="form" onSubmit={handleRepor}>
            <p>
              <strong>{repondo.nome}</strong> · estoque atual: {repondo.estoque}
            </p>
            <label className="campo">
              <span>Quantidade a somar</span>
              <input
                type="number"
                min={1}
                step={1}
                autoFocus
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                required
              />
            </label>
            {Number.isInteger(Number(quantidade)) && Number(quantidade) > 0 && (
              <p className="dica">Novo estoque: {repondo.estoque + Number(quantidade)}</p>
            )}
            {erroRepor && <p className="msg erro">{erroRepor}</p>}
            <div className="modal-acoes">
              <button type="button" className="secundario" onClick={fecharRepor} disabled={enviando}>
                Cancelar
              </button>
              <button type="submit" disabled={enviando}>
                {enviando ? 'Salvando...' : 'Repor estoque'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmarModal
        aberto={desativando !== null}
        titulo="Desativar produto?"
        textoConfirmar="Desativar"
        carregando={processando}
        onConfirmar={() => desativando && mudarStatus(desativando, 'DESATIVADO')}
        onCancelar={cancelarDesativar}
      >
        {desativando && (
          <>
            <p>
              <strong>{desativando.nome}</strong>
            </p>
            <p>
              O produto não aparece mais para novos pedidos. Os pedidos já feitos não mudam e o produto pode ser
              reativado depois.
            </p>
          </>
        )}
      </ConfirmarModal>
    </>
  );
}
