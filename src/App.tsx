import { useState, type ChangeEvent, type FormEvent } from 'react';
import { cadastrarCliente, cadastrarProduto, listarClientes, listarProdutos } from './services/api';
import type { ClienteCategoria, ClienteListarResponse, ProdutoListarResponse } from './types';

type Mensagem = { tipo: 'sucesso' | 'erro'; texto: string } | null;

type ItemLista = { chave: string; titulo: string; detalhes: string[] };

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Estado inicial dos formulários (número vira string porque o <input> trabalha com texto)
const CLIENTE_VAZIO = { name: '', cpf: '', telefone: '', email: '', categoria: 'NORMAL' as ClienteCategoria };
const PRODUTO_VAZIO = { nome: '', descricao: '', estoque: '', preco: '' };

interface ListaCardProps {
  titulo: string;
  textoBotao: string;
  itens: ItemLista[] | null; // null = ainda não listou
  carregando: boolean;
  erro: string | null;
  onListar: () => void;
}

/** Card da coluna da direita: botão "Listar" + os itens retornados. */
function ListaCard({ titulo, textoBotao, itens, carregando, erro, onListar }: ListaCardProps) {
  return (
    <section className="card">
      <h2>{titulo}</h2>
      {erro && <p className="msg erro">{erro}</p>}
      {itens && itens.length === 0 && <p className="vazio">Nenhum registro encontrado.</p>}
      {itens && itens.length > 0 && (
        <ul className="lista">
          {itens.map((item) => (
            <li key={item.chave}>
              <strong>{item.titulo}</strong>
              {item.detalhes.map((detalhe) => (
                <span key={detalhe}>{detalhe}</span>
              ))}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onListar} disabled={carregando}>
        {carregando ? 'Carregando...' : textoBotao}
      </button>
    </section>
  );
}

export default function App() {
  // ---------- Cadastro: Cliente ----------
  const [formCliente, setFormCliente] = useState(CLIENTE_VAZIO);
  const [msgCliente, setMsgCliente] = useState<Mensagem>(null);
  const [enviandoCliente, setEnviandoCliente] = useState(false);

  // ---------- Cadastro: Produto ----------
  const [formProduto, setFormProduto] = useState(PRODUTO_VAZIO);
  const [msgProduto, setMsgProduto] = useState<Mensagem>(null);
  const [enviandoProduto, setEnviandoProduto] = useState(false);

  // ---------- Listagem ----------
  const [clientes, setClientes] = useState<ClienteListarResponse[] | null>(null);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [erroClientes, setErroClientes] = useState<string | null>(null);

  const [produtos, setProdutos] = useState<ProdutoListarResponse[] | null>(null);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [erroProdutos, setErroProdutos] = useState<string | null>(null);

  /** Atualiza um campo do formulário pelo atributo name do input. */
  function campo<T extends Record<string, string>>(setForm: (fn: (f: T) => T) => void) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function carregarClientes() {
    setCarregandoClientes(true);
    setErroClientes(null);
    try {
      setClientes(await listarClientes());
    } catch (err) {
      setErroClientes((err as Error).message);
    } finally {
      setCarregandoClientes(false);
    }
  }

  async function carregarProdutos() {
    setCarregandoProdutos(true);
    setErroProdutos(null);
    try {
      setProdutos(await listarProdutos());
    } catch (err) {
      setErroProdutos((err as Error).message);
    } finally {
      setCarregandoProdutos(false);
    }
  }

  async function handleCliente(e: FormEvent) {
    e.preventDefault();
    setEnviandoCliente(true);
    setMsgCliente(null);
    try {
      await cadastrarCliente(formCliente);
      setMsgCliente({ tipo: 'sucesso', texto: 'Cliente cadastrado!' });
      setFormCliente(CLIENTE_VAZIO);
      // Se a lista já estava aberta, atualiza para mostrar o novo cliente
      if (clientes !== null) carregarClientes();
    } catch (err) {
      setMsgCliente({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setEnviandoCliente(false);
    }
  }

  async function handleProduto(e: FormEvent) {
    e.preventDefault();
    setEnviandoProduto(true);
    setMsgProduto(null);
    try {
      await cadastrarProduto({
        nome: formProduto.nome,
        descricao: formProduto.descricao,
        estoque: Number(formProduto.estoque),
        preco: Number(formProduto.preco),
      });
      setMsgProduto({ tipo: 'sucesso', texto: 'Produto cadastrado!' });
      setFormProduto(PRODUTO_VAZIO);
      if (produtos !== null) carregarProdutos();
    } catch (err) {
      setMsgProduto({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setEnviandoProduto(false);
    }
  }

  const onClienteChange = campo(setFormCliente);
  const onProdutoChange = campo(setFormProduto);

  return (
    <main className="container">
      {/* ===================== ESQUERDA: CADASTRO ===================== */}
      <div className="coluna">
        <h1>Cadastro</h1>

        <form className="card" onSubmit={handleCliente}>
          <h2>Cliente</h2>
          <input
            name="name"
            type="text"
            placeholder="Nome do cliente"
            value={formCliente.name}
            onChange={onClienteChange}
            minLength={3}
            maxLength={60}
            required
          />
          <input
            name="cpf"
            type="text"
            inputMode="numeric"
            placeholder="CPF"
            value={formCliente.cpf}
            onChange={onClienteChange}
            maxLength={14}
            required
          />
          <input
            name="telefone"
            type="tel"
            placeholder="Telefone"
            value={formCliente.telefone}
            onChange={onClienteChange}
          />
          <input
            name="email"
            type="email"
            placeholder="E-mail"
            value={formCliente.email}
            onChange={onClienteChange}
            required
          />
          <select name="categoria" value={formCliente.categoria} onChange={onClienteChange}>
            <option value="NORMAL">Normal</option>
            <option value="VIP">VIP</option>
          </select>
          {msgCliente && <p className={`msg ${msgCliente.tipo}`}>{msgCliente.texto}</p>}
          <button type="submit" disabled={enviandoCliente}>
            {enviandoCliente ? 'Enviando...' : 'Cadastrar cliente'}
          </button>
        </form>

        <form className="card" onSubmit={handleProduto}>
          <h2>Produto</h2>
          <input
            name="nome"
            type="text"
            placeholder="Nome do produto"
            value={formProduto.nome}
            onChange={onProdutoChange}
            required
          />
          <input
            name="descricao"
            type="text"
            placeholder="Descrição"
            value={formProduto.descricao}
            onChange={onProdutoChange}
          />
          <input
            name="preco"
            type="number"
            placeholder="Preço (R$)"
            value={formProduto.preco}
            onChange={onProdutoChange}
            min={0}
            step="0.01"
            required
          />
          <input
            name="estoque"
            type="number"
            placeholder="Estoque"
            value={formProduto.estoque}
            onChange={onProdutoChange}
            min={0}
            step={1}
            required
          />
          {msgProduto && <p className={`msg ${msgProduto.tipo}`}>{msgProduto.texto}</p>}
          <button type="submit" disabled={enviandoProduto}>
            {enviandoProduto ? 'Enviando...' : 'Cadastrar produto'}
          </button>
        </form>
      </div>

      {/* ===================== DIREITA: LISTAGEM ===================== */}
      <div className="coluna">
        <h1>Listagem</h1>

        <ListaCard
          titulo="Cliente"
          textoBotao="Listar clientes"
          carregando={carregandoClientes}
          erro={erroClientes}
          onListar={carregarClientes}
          itens={
            clientes &&
            clientes.map((c) => ({
              chave: c.email, // e-mail é único; a listagem do back não traz id
              titulo: c.name,
              detalhes: [
                `Telefone: ${c.telefone || '—'}`,
                `E-mail: ${c.email}`,
                `Categoria: ${c.categoria}`,
              ],
            }))
          }
        />

        <ListaCard
          titulo="Produto"
          textoBotao="Listar produtos"
          carregando={carregandoProdutos}
          erro={erroProdutos}
          onListar={carregarProdutos}
          itens={
            produtos &&
            produtos.map((p, i) => ({
              chave: `${i}-${p.nome}`, // a listagem do back não traz id
              titulo: p.nome,
              detalhes: [
                p.descricao || 'Sem descrição',
                `Preço: ${moeda.format(Number(p.preco))}`,
                `Estoque: ${p.estoque}`,
              ],
            }))
          }
        />
      </div>
    </main>
  );
}
