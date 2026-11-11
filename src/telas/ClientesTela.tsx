import { useState, type FormEvent } from 'react';
import ListaCard from '../components/ListaCard';
import { cadastrarCliente, listarClientes } from '../services/api';
import type { ClienteCategoria, ClienteListarResponse } from '../types';
import { campo, moeda, type Mensagem } from '../utils';

// Estado inicial do formulário (número vira string porque o <input> trabalha com texto)
const FORM_VAZIO = {
  name: '',
  cnpj: '',
  telefone: '',
  email: '',
  categoria: 'NORMAL' as ClienteCategoria,
  limiteCredito: '',
};

export default function ClientesTela() {
  const [form, setForm] = useState(FORM_VAZIO);
  const [msg, setMsg] = useState<Mensagem>(null);
  const [enviando, setEnviando] = useState(false);

  const [clientes, setClientes] = useState<ClienteListarResponse[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const onChange = campo(setForm);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setClientes(await listarClientes());
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
      await cadastrarCliente({ ...form, limiteCredito: Number(form.limiteCredito) });
      setMsg({ tipo: 'sucesso', texto: 'Cliente cadastrado!' });
      setForm(FORM_VAZIO);
      if (clientes !== null) carregar(); // lista já aberta: atualiza
    } catch (err) {
      setMsg({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <h1>Clientes</h1>
      <div className="tela">
        <form className="card" onSubmit={handleSubmit}>
          <h2>Cadastro</h2>
          <input
            name="name"
            type="text"
            placeholder="Nome ou razão social"
            value={form.name}
            onChange={onChange}
            minLength={3}
            maxLength={60}
            required
          />
          <input name="cnpj" type="text" placeholder="CNPJ" value={form.cnpj} onChange={onChange} maxLength={18} required />
          <input name="telefone" type="tel" placeholder="Telefone" value={form.telefone} onChange={onChange} />
          <input name="email" type="email" placeholder="E-mail" value={form.email} onChange={onChange} required />
          <select name="categoria" value={form.categoria} onChange={onChange}>
            <option value="NORMAL">Normal</option>
            <option value="VIP">VIP</option>
          </select>
          <input
            name="limiteCredito"
            type="number"
            placeholder="Limite de crédito (R$)"
            value={form.limiteCredito}
            onChange={onChange}
            min={0}
            step="0.01"
            required
          />
          {msg && <p className={`msg ${msg.tipo}`}>{msg.texto}</p>}
          <button type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Cadastrar cliente'}
          </button>
        </form>

        <ListaCard
          titulo="Listagem"
          textoBotao="Listar clientes"
          carregando={carregando}
          erro={erro}
          onListar={carregar}
          itens={
            clientes &&
            clientes.map((c) => ({
              chave: String(c.id),
              titulo: c.name,
              detalhes: [
                `Telefone: ${c.telefone || '—'}`,
                `E-mail: ${c.email}`,
                `Classificação: ${c.categoria}`,
                `Limite de crédito: ${moeda.format(c.limiteCredito)}`,
              ],
            }))
          }
        />
      </div>
    </>
  );
}
