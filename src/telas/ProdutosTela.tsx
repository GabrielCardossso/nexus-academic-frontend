import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Aviso from '../components/Aviso';
import Modal from '../components/Modal';
import Selecao, { type Opcao } from '../components/Selecao';
import { cadastrarProduto, listarProdutos } from '../services/api';
import type { ProdutoListarResponse, ProdutoStatus } from '../types';
import { campo, moeda, type Mensagem } from '../utils';

const FORM_VAZIO = {
  nome: '',
  descricao: '',
  estoque: '',
  precoVenda: '',
  precoAluguel: '',
  status: 'DISPONIVEL' as ProdutoStatus,
};

const ROTULO_STATUS: Record<ProdutoStatus, string> = {
  DISPONIVEL: 'Disponível',
  INDISPONIVEL: 'Indisponível',
  DESATIVADO: 'Desativado',
};

const OPCOES_STATUS: Opcao<ProdutoStatus>[] = (Object.keys(ROTULO_STATUS) as ProdutoStatus[]).map((s) => ({
  valor: s,
  rotulo: ROTULO_STATUS[s],
}));

export default function ProdutosTela() {
  const [produtos, setProdutos] = useState<ProdutoListarResponse[] | null>(null); // null = carregando
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Mensagem>(null);

  const [novoAberto, setNovoAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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
    setErroForm(null);
    setNovoAberto(true);
  }

  const fecharNovo = useCallback(() => setNovoAberto(false), []);
  const fecharAviso = useCallback(() => setAviso(null), []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErroForm(null);
    try {
      await cadastrarProduto({
        ...form,
        estoque: Number(form.estoque),
        precoVenda: Number(form.precoVenda),
        precoAluguel: Number(form.precoAluguel),
      });
      setAviso({ tipo: 'sucesso', texto: `Produto "${form.nome.trim()}" cadastrado!` });
      setNovoAberto(false);
      await carregar();
    } catch (err) {
      setErroForm((err as Error).message);
    } finally {
      setEnviando(false);
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
        {(produtos ?? []).map((p) => (
          <li key={p.id} className="item">
            <div className="item-topo">
              <span className="item-titulo">{p.nome}</span>
              <span className={`selo ${p.status.toLowerCase()}`}>{ROTULO_STATUS[p.status]}</span>
            </div>
            {p.descricao && <p className="item-info">{p.descricao}</p>}
            <p className="item-info">
              Estoque: {p.estoque} · Venda: {moeda.format(Number(p.precoVenda))} · Aluguel:{' '}
              {moeda.format(Number(p.precoAluguel))}/mês
            </p>
          </li>
        ))}
      </ul>

      <Modal aberto={novoAberto} titulo="Novo produto" onFechar={fecharNovo} bloqueado={enviando}>
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
            <label className="campo">
              <span>Estoque</span>
              <input name="estoque" type="number" value={form.estoque} onChange={onChange} min={0} step={1} required />
            </label>
            <label className="campo">
              <span>Status</span>
              <Selecao
                value={form.status}
                onChange={(status) => setForm((f) => ({ ...f, status }))}
                opcoes={OPCOES_STATUS}
              />
            </label>
          </div>
          {erroForm && <p className="msg erro">{erroForm}</p>}
          <div className="modal-acoes">
            <button type="button" className="secundario" onClick={fecharNovo} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Cadastrar produto'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
