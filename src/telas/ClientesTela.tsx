import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Modal from '../components/Modal';
import { cadastrarCliente, listarClientes } from '../services/api';
import type { ClienteCategoria, ClienteListarResponse } from '../types';
import { campo, contem, moeda, type Mensagem } from '../utils';

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
  const [clientes, setClientes] = useState<ClienteListarResponse[] | null>(null); // null = carregando
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [aviso, setAviso] = useState<Mensagem>(null); // mensagem de sucesso na tela

  const [novoAberto, setNovoAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const onChange = campo(setForm);

  async function carregar() {
    setErroLista(null);
    try {
      setClientes(await listarClientes());
    } catch (err) {
      setErroLista((err as Error).message);
      setClientes([]);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErroForm(null);
    try {
      await cadastrarCliente({ ...form, limiteCredito: Number(form.limiteCredito) });
      setAviso({ tipo: 'sucesso', texto: `Cliente "${form.name.trim()}" cadastrado!` });
      setNovoAberto(false);
      await carregar();
    } catch (err) {
      setErroForm((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const filtrados = (clientes ?? []).filter((c) => contem(busca, c.name, c.email, c.telefone));

  return (
    <>
      <div className="topo">
        <h1>Clientes</h1>
        <button type="button" onClick={abrirNovo}>
          + Novo cliente
        </button>
      </div>

      {aviso && <p className={`msg ${aviso.tipo} aviso-topo`}>{aviso.texto}</p>}

      <div className="filtros">
        <input
          type="search"
          placeholder="Buscar por nome, e-mail ou telefone"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar clientes"
        />
      </div>

      {erroLista && <p className="msg erro">{erroLista}</p>}
      {clientes === null && <p className="vazio">Carregando clientes...</p>}
      {clientes && (
        <p className="contagem">
          {filtrados.length} de {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
        </p>
      )}
      {clientes && filtrados.length === 0 && (
        <p className="vazio">{clientes.length === 0 ? 'Nenhum cliente cadastrado ainda.' : 'Nenhum cliente encontrado.'}</p>
      )}

      <ul className="itens">
        {filtrados.map((c) => (
          <li key={c.id} className="item">
            <div className="item-topo">
              <span className="item-titulo">{c.name}</span>
              <div className="selos">
                <span className={`selo ${c.categoria === 'VIP' ? 'vip' : 'neutro'}`}>
                  {c.categoria === 'VIP' ? 'VIP' : 'Normal'}
                </span>
                <span className={`selo ${c.inadimplente ? 'inadimplente' : 'em-dia'}`}>
                  {c.inadimplente ? 'Inadimplente' : 'Em dia'}
                </span>
              </div>
            </div>
            <p className="item-info">
              {c.email}
              {c.telefone && ` · ${c.telefone}`}
            </p>
            <p className="item-info">Limite de crédito disponível: {moeda.format(c.limiteCredito)}</p>
          </li>
        ))}
      </ul>

      <Modal aberto={novoAberto} titulo="Novo cliente" onFechar={fecharNovo} bloqueado={enviando}>
        <form className="form" onSubmit={handleSubmit}>
          <div className="form-grade">
            <label className="campo inteiro">
              <span>Nome ou razão social</span>
              <input name="name" type="text" value={form.name} onChange={onChange} minLength={3} maxLength={60} required />
            </label>
            <label className="campo">
              <span>CNPJ</span>
              <input name="cnpj" type="text" value={form.cnpj} onChange={onChange} maxLength={18} required />
            </label>
            <label className="campo">
              <span>Telefone</span>
              <input name="telefone" type="tel" value={form.telefone} onChange={onChange} />
            </label>
            <label className="campo inteiro">
              <span>E-mail</span>
              <input name="email" type="email" value={form.email} onChange={onChange} required />
            </label>
            <label className="campo">
              <span>Categoria</span>
              <select name="categoria" value={form.categoria} onChange={onChange}>
                <option value="NORMAL">Normal</option>
                <option value="VIP">VIP</option>
              </select>
            </label>
            <label className="campo">
              <span>Limite de crédito (R$)</span>
              <input
                name="limiteCredito"
                type="number"
                value={form.limiteCredito}
                onChange={onChange}
                min={0}
                step="0.01"
                required
              />
            </label>
          </div>
          {erroForm && <p className="msg erro">{erroForm}</p>}
          <div className="modal-acoes">
            <button type="button" className="secundario" onClick={fecharNovo} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Cadastrar cliente'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
