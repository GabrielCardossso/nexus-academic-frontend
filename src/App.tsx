import { useState, type FormEvent } from 'react';
import { cadastrarCliente, cadastrarProduto } from './services/api';

type Mensagem = { tipo: 'sucesso' | 'erro'; texto: string } | null;

export default function App() {
  // Cliente
  const [nomeCliente, setNomeCliente] = useState('');
  const [contatoCliente, setContatoCliente] = useState('');
  const [msgCliente, setMsgCliente] = useState<Mensagem>(null);
  const [enviandoCliente, setEnviandoCliente] = useState(false);

  // Produto
  const [nomeProduto, setNomeProduto] = useState('');
  const [codigoProduto, setCodigoProduto] = useState('');
  const [msgProduto, setMsgProduto] = useState<Mensagem>(null);
  const [enviandoProduto, setEnviandoProduto] = useState(false);

  async function handleCliente(e: FormEvent) {
    e.preventDefault();
    setEnviandoCliente(true);
    setMsgCliente(null);
    try {
      await cadastrarCliente({ nome: nomeCliente, contato: contatoCliente });
      setMsgCliente({ tipo: 'sucesso', texto: 'Cliente cadastrado!' });
      setNomeCliente('');
      setContatoCliente('');
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
    } catch (err) {
      setMsgProduto({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setEnviandoProduto(false);
    }
  }

  return (
    <main className="container">
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
        <button type="submit" disabled={enviandoCliente}>
          {enviandoCliente ? 'Enviando...' : 'Cadastrar cliente'}
        </button>
        {msgCliente && <p className={`msg ${msgCliente.tipo}`}>{msgCliente.texto}</p>}
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
        <button type="submit" disabled={enviandoProduto}>
          {enviandoProduto ? 'Enviando...' : 'Cadastrar produto'}
        </button>
        {msgProduto && <p className={`msg ${msgProduto.tipo}`}>{msgProduto.texto}</p>}
      </form>
    </main>
  );
}
