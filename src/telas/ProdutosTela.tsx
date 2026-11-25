import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Aviso from '../components/comum/Aviso';
import ConfirmarModal from '../components/comum/ConfirmarModal';
import Modal from '../components/comum/Modal';
import { ROTULO_STATUS_PRODUTO } from '../regras';
import { cadastrarProduto, editarProduto, excluirProduto, listarProdutos, reporEstoque } from '../services/api';
import type { ProdutoListarResponse } from '../types';
import { campo, moeda, type Mensagem } from '../utils';

// Sem status: o back não recebe nem no cadastro (grava DISPONIVEL) nem na edição.
const FORM_VAZIO = {
  nome: '',
  descricao: '',
  estoque: '',
  precoVenda: '',
  precoAluguel: '',
};

export default function ProdutosTela() {
  const [produtos, setProdutos] = useState<ProdutoListarResponse[] | null>(null); // null = carregando
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Mensagem>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<ProdutoListarResponse | null>(null); // null = cadastro novo
  const [form, setForm] = useState(FORM_VAZIO);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [repondo, setRepondo] = useState<ProdutoListarResponse | null>(null); // popup de reposição
  const [quantidade, setQuantidade] = useState('');
  const [erroRepor, setErroRepor] = useState<string | null>(null);

  const [excluindo, setExcluindo] = useState<ProdutoListarResponse | null>(null);
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
  const fecharExclusao = useCallback(() => setExcluindo(null), []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErroForm(null);
    try {
      const precos = { precoVenda: Number(form.precoVenda), precoAluguel: Number(form.precoAluguel) };
      if (editando) {
        await editarProduto(editando.id, { nome: form.nome, descricao: form.descricao, ...precos });
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
      const estoque = await reporEstoque(repondo.id, qtd);
      setAviso({ tipo: 'sucesso', texto: `Estoque de "${repondo.nome}" reposto: +${qtd} (agora ${estoque}).` });
      setRepondo(null);
      await carregar();
    } catch (err) {
      setErroRepor((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setAviso(null);
    setProcessando(true);
    try {
      await excluirProduto(excluindo.id);
      setAviso({ tipo: 'sucesso', texto: `Produto "${excluindo.nome}" excluído.` });
      await carregar();
    } catch (err) {
      setAviso({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setProcessando(false);
      setExcluindo(null);
    }
  }

  return (
    <>
      <div className="topo">
        <h1>Produtos</h1>
        <button type="button" className="destaque" onClick={abrirNovo}>
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
        {(produtos ?? []).map((p) => (
          <li key={p.id} className={`item ${p.status === 'DESATIVADO' ? 'inativo' : ''}`}>
            <div className="item-topo">
              <span className="item-titulo">{p.nome}</span>
              {p.status ? (
                <span className={`selo ${p.status.toLowerCase()}`}>{ROTULO_STATUS_PRODUTO[p.status]}</span>
              ) : (
                <span className="selo neutro" title="Produto sem status no banco.">
                  Sem status
                </span>
              )}
            </div>
            {p.descricao && <p className="item-info">{p.descricao}</p>}
            <p className="item-info">
              Estoque: {p.estoque} · Venda: {moeda.format(Number(p.precoVenda))} · Aluguel:{' '}
              {moeda.format(Number(p.precoAluguel))}
            </p>
            <div className="acoes">
              <button type="button" className="confirmar" onClick={() => abrirRepor(p)}>
                Repor estoque
              </button>
              <button type="button" className="secundario" onClick={() => abrirEditar(p)}>
                Editar
              </button>
              <button type="button" className="secundario" onClick={() => setExcluindo(p)}>
                Excluir
              </button>
            </div>
          </li>
        ))}
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
              <span>Preço de aluguel (R$)</span>
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
            {!editando && (
              <label className="campo">
                <span>Estoque</span>
                <input name="estoque" type="number" value={form.estoque} onChange={onChange} min={0} step={1} required />
              </label>
            )}
          </div>
          <p className="dica">
            {editando
              ? `Estoque atual: ${editando.estoque}. Para aumentar, use "Repor estoque". O status não é editável (o back não recebe). Pedidos já feitos mantêm o valor do momento; na edição de um pedido, os itens são recalculados pelo preço atual.`
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
        aberto={excluindo !== null}
        titulo="Excluir produto?"
        textoConfirmar="Excluir"
        carregando={processando}
        onConfirmar={confirmarExclusao}
        onCancelar={fecharExclusao}
      >
        {excluindo && (
          <>
            <p>
              <strong>{excluindo.nome}</strong>
            </p>
            <p>
              O produto sai da lista e não entra em pedidos novos. Os pedidos já feitos não mudam. Não é possível excluir
              produto que esteja em pedido pendente ou em aluguel ainda não devolvido. O back ainda não tem como reativar
              um produto excluído.
            </p>
          </>
        )}
      </ConfirmarModal>
    </>
  );
}
