import { useState, type FormEvent } from 'react';
import {
  cadastrarCliente,
  cadastrarProduto,
  listarClientes,
  listarProdutos,
  type ClienteResponse,
  type ProdutoResponse,
} from './services/api';

type Mensagem = { tipo: 'sucesso' | 'erro'; texto: string } | null;

type ItemLista = { chave: string; titulo: string; detalhe: string };

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
              <span>{item.detalhe}</span>
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
  const [nomeCliente, setNomeCliente] = useState('');
  const [contatoCliente, setContatoCliente] = useState('');
  const [msgCliente, setMsgCliente] = useState<Mensagem>(null);
  const [enviandoCliente, setEnviandoCliente] = useState(false);

  // ---------- Cadastro: Produto ----------
  const [nomeProduto, setNomeProduto] = useState('');
  const [codigoProduto, setCodigoProduto] = useState('');
  const [msgProduto, setMsgProduto] = useState<Mensagem>(null);
  const [enviandoProduto, setEnviandoProduto] = useState(false);

  // ---------- Listagem ----------
  const [clientes, setClientes] = useState<ClienteResponse[] | null>(null);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [erroClientes, setErroClientes] = useState<string | null>(null);

  const [produtos, setProdutos] = useState<ProdutoResponse[] | null>(null);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [erroProdutos, setErroProdutos] = useState<string | null>(null);

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
      await cadastrarCliente({ nome: nomeCliente, contato: contatoCliente });
      setMsgCliente({ tipo: 'sucesso', texto: 'Cliente cadastrado!' });
      setNomeCliente('');
      setContatoCliente('');
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
      await cadastrarProduto({ nome: nomeProduto, codigo: codigoProduto });
      setMsgProduto({ tipo: 'sucesso', texto: 'Produto cadastrado!' });
      setNomeProduto('');
      setCodigoProduto('');
      if (produtos !== null) carregarProdutos();
    } catch (err) {
      setMsgProduto({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setEnviandoProduto(false);
    }
  }

  return (
    <main className="container">
      {/* ===================== ESQUERDA: CADASTRO ===================== */}
      <div className="coluna">
        <h1>Cadastro</h1>

        <form className="card" onSubmit={handleCliente}>
          <h2>Cliente</h2>
          <input
            type="text"
            placeholder="Nome do cliente"
            value={nomeCliente}
            onChange={(e) => setNomeCliente(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Telefone ou e-mail"
            value={contatoCliente}
            onChange={(e) => setContatoCliente(e.target.value)}
            required
          />
          {msgCliente && <p className={`msg ${msgCliente.tipo}`}>{msgCliente.texto}</p>}
          <button type="submit" disabled={enviandoCliente}>
            {enviandoCliente ? 'Enviando...' : 'Cadastrar cliente'}
          </button>
        </form>

        <form className="card" onSubmit={handleProduto}>
          <h2>Produto</h2>
          <input
            type="text"
            placeholder="Nome do produto"
            value={nomeProduto}
            onChange={(e) => setNomeProduto(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Código do produto"
            value={codigoProduto}
            onChange={(e) => setCodigoProduto(e.target.value)}
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
            clientes.map((c, i) => ({
              chave: String(c.id ?? i),
              titulo: c.nome,
              detalhe: c.contato,
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
              chave: String(p.id ?? i),
              titulo: p.nome,
              detalhe: `Código: ${p.codigo}`,
            }))
          }
        />
      </div>
    </main>
  );
}