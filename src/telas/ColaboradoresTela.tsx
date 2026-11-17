import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Aviso from '../components/Aviso';
import Modal from '../components/Modal';
import { cadastrarColaborador, listarColaboradores, listarPedidos } from '../services/api';
import type { Colaborador, Pedido } from '../types';
import { campo, contem, formatarCpf, type Mensagem } from '../utils';

const FORM_VAZIO = { nome: '', cpf: '', email: '' };

export default function ColaboradoresTela() {
  const [colaboradores, setColaboradores] = useState<Colaborador[] | null>(null); // null = carregando
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [aviso, setAviso] = useState<Mensagem>(null);

  const [novoAberto, setNovoAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const onChange = campo(setForm);

  async function carregar() {
    setErroLista(null);
    try {
      const [c, p] = await Promise.all([listarColaboradores(), listarPedidos()]);
      setColaboradores(c);
      setPedidos(p);
    } catch (err) {
      setErroLista((err as Error).message);
      setColaboradores([]);
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
      const novo = await cadastrarColaborador(form);
      setAviso({ tipo: 'sucesso', texto: `Colaborador "${novo.nome}" cadastrado!` });
      setNovoAberto(false);
      await carregar();
    } catch (err) {
      setErroForm((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  /** Quantas solicitações de desconto o colaborador já decidiu. */
  const decisoesDe = (id: number) => pedidos.filter((p) => p.solicitacao?.colaboradorId === id).length;

  const filtrados = (colaboradores ?? []).filter((c) => contem(busca, c.nome, c.email, c.cpf, formatarCpf(c.cpf)));

  return (
    <>
      <div className="topo">
        <h1>Colaboradores</h1>
        <button type="button" onClick={abrirNovo}>
          + Novo colaborador
        </button>
      </div>

      <Aviso msg={aviso} onFechar={fecharAviso} />

      <div className="filtros">
        <input
          type="search"
          placeholder="Buscar por nome, CPF ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar colaboradores"
        />
      </div>

      {erroLista && <p className="msg erro">{erroLista}</p>}
      {colaboradores === null && <p className="vazio">Carregando colaboradores...</p>}
      {colaboradores && (
        <p className="contagem">
          {filtrados.length} de {colaboradores.length} {colaboradores.length === 1 ? 'colaborador' : 'colaboradores'}
        </p>
      )}
      {colaboradores && filtrados.length === 0 && (
        <p className="vazio">
          {colaboradores.length === 0 ? 'Nenhum colaborador cadastrado ainda.' : 'Nenhum colaborador encontrado.'}
        </p>
      )}

      <ul className="itens">
        {filtrados.map((c) => {
          const decisoes = decisoesDe(c.id);
          return (
            <li key={c.id} className="item">
              <div className="item-topo">
                <span className="item-titulo">{c.nome}</span>
                <span className="item-sub">ID {c.id}</span>
              </div>
              <p className="item-info">
                CPF {formatarCpf(c.cpf)} · {c.email}
              </p>
              <p className="item-info">
                {decisoes === 0
                  ? 'Ainda não decidiu solicitações de desconto'
                  : `${decisoes} ${decisoes === 1 ? 'solicitação de desconto decidida' : 'solicitações de desconto decididas'}`}
              </p>
            </li>
          );
        })}
      </ul>

      <Modal aberto={novoAberto} titulo="Novo colaborador" onFechar={fecharNovo} bloqueado={enviando}>
        <form className="form" onSubmit={handleSubmit}>
          <div className="form-grade">
            <label className="campo inteiro">
              <span>Nome</span>
              <input name="nome" type="text" value={form.nome} onChange={onChange} minLength={3} maxLength={60} required />
            </label>
            <label className="campo">
              <span>CPF</span>
              <input
                name="cpf"
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={onChange}
                maxLength={14}
                required
              />
            </label>
            <label className="campo">
              <span>E-mail</span>
              <input name="email" type="email" value={form.email} onChange={onChange} required />
            </label>
          </div>
          {erroForm && <p className="msg erro">{erroForm}</p>}
          <div className="modal-acoes">
            <button type="button" className="secundario" onClick={fecharNovo} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Cadastrar colaborador'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
