import { useState, type FormEvent } from 'react';
import ListaCard from '../components/ListaCard';
import { cadastrarProduto, listarProdutos } from '../services/api';
import type { ProdutoListarResponse, ProdutoStatus } from '../types';
import { campo, moeda, type Mensagem } from '../utils';

const FORM_VAZIO = {
  nome: '',
  descricao: '',
  estoque: '',
  preco: '',
  status: 'DISPONIVEL' as ProdutoStatus,
};

export default function ProdutosTela() {
  const [form, setForm] = useState(FORM_VAZIO);
  const [msg, setMsg] = useState<Mensagem>(null);
  const [enviando, setEnviando] = useState(false);

  const [produtos, setProdutos] = useState<ProdutoListarResponse[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const onChange = campo(setForm);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setProdutos(await listarProdutos());
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    try {
      await cadastrarProduto({
        ...form,
        estoque: Number(form.estoque),
        preco: Number(form.preco),
      });
      setMsg({ tipo: 'sucesso', texto: 'Produto cadastrado!' });
      setForm(FORM_VAZIO);
      if (produtos !== null) carregar();
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <h1>Produtos</h1>
      <div className="tela">
        <form className="card" onSubmit={handleSubmit}>
          <h2>Cadastro</h2>
          <input name="nome" type="text" placeholder="Nome do produto" value={form.nome} onChange={onChange} required />
          <input name="descricao" type="text" placeholder="Descrição" value={form.descricao} onChange={onChange} />
          <input
            name="estoque"
            type="number"
            placeholder="Estoque"
            value={form.estoque}
            onChange={onChange}
            min={0}
            step={1}
            required
          />
          <input
            name="preco"
            type="number"
            placeholder="Preço (R$)"
            value={form.preco}
            onChange={onChange}
            min={0}
            step="0.01"
            required
          />
          <select name="status" value={form.status} onChange={onChange}>
            <option value="DISPONIVEL">Disponível</option>
            <option value="INDISPONIVEL">Indisponível</option>
            <option value="DESATIVADO">Desativado</option>
          </select>
          {msg && <p className={`msg ${msg.tipo}`}>{msg.texto}</p>}
          <button type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Cadastrar produto'}
          </button>
        </form>

        <ListaCard
          titulo="Listagem"
          textoBotao="Listar produtos"
          carregando={carregando}
          erro={erro}
          onListar={carregar}
          itens={
            produtos &&
            produtos.map((p) => ({
              chave: String(p.id),
              titulo: p.nome,
              detalhes: [
                p.descricao || 'Sem descrição',
                `Estoque: ${p.estoque}`,
                `Preço: ${moeda.format(Number(p.preco))}`,
                `Status: ${p.status}`,
              ],
            }))
          }
        />
      </div>
    </>
  );
}
