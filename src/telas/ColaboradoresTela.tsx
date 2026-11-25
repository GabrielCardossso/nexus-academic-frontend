import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Aviso from '../components/comum/Aviso';
import ConfirmarModal from '../components/comum/ConfirmarModal';
import Modal from '../components/comum/Modal';
import {
  cadastrarColaborador,
  editarColaborador,
  excluirColaborador,
  listarColaboradores,
  listarPedidos,
  reativarColaborador,
} from '../services/api';
import { decididoPorColaborador } from '../regras';
import type { Colaborador, Pedido } from '../types';
import { campo, formatarCpf, type Mensagem } from '../utils';

const FORM_VAZIO = { nome: '', cpf: '', email: '' };

export default function ColaboradoresTela() {
  const [colaboradores, setColaboradores] = useState<Colaborador[] | null>(null); // null = carregando
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Mensagem>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null); // null = cadastro novo
  const [form, setForm] = useState(FORM_VAZIO);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [desativando, setDesativando] = useState<Colaborador | null>(null);
  const [processando, setProcessando] = useState(false);

  const onChange = campo(setForm);

  async function carregar() {
    setErroLista(null);
    try {
      // Pedidos só servem para contar as decisões; se não estiverem disponíveis (back), a lista aparece igual.
      const [c, p] = await Promise.all([listarColaboradores(), listarPedidos().catch((): Pedido[] => [])]);
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
    setEditandoId(null);
    setErroForm(null);
    setFormAberto(true);
  }

  function abrirEditar(c: Colaborador) {
    setForm({ nome: c.nome, cpf: formatarCpf(c.cpf), email: c.email });
    setEditandoId(c.id);
    setErroForm(null);
    setFormAberto(true);
  }

  const fecharForm = useCallback(() => setFormAberto(false), []);
  const fecharAviso = useCallback(() => setAviso(null), []);
  const cancelarDesativar = useCallback(() => setDesativando(null), []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErroForm(null);
    try {
      // TRAVA DO FRONT: no cadastro o back não confere CPF repetido (só na edição); a tela confere.
      const cpf = form.cpf.replace(/\D/g, ''); // só dígitos: "123.456.789-09" → "12345678909"
      if (editandoId === null && (colaboradores ?? []).some((c) => c.ativo !== false && c.cpf === cpf)) {
        throw new Error('Já existe um colaborador com esse CPF.');
      }
      if (editandoId === null) await cadastrarColaborador(form);
      else await editarColaborador(editandoId, form);
      setAviso({ tipo: 'sucesso', texto: `Colaborador "${form.nome.trim()}" ${editandoId === null ? 'cadastrado' : 'atualizado'}!` });
      setFormAberto(false);
      await carregar();
    } catch (err) {
      setErroForm((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function mudarAtivo(c: Colaborador, ativo: boolean) {
    setAviso(null);
    setProcessando(true);
    try {
      await (ativo ? reativarColaborador(c.id) : excluirColaborador(c.id));
      setAviso({ tipo: 'sucesso', texto: `Colaborador "${c.nome}" ${ativo ? 'reativado' : 'desativado'}.` });
      await carregar();
    } catch (err) {
      setAviso({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setProcessando(false);
      setDesativando(null);
    }
  }

  /** Quantas solicitações de desconto o colaborador já decidiu. */
  const decisoesDe = (c: Colaborador) =>
    pedidos.filter(
      (p) =>
        decididoPorColaborador(p.statusAprovacaoDesconto) &&
        p.colaboradorDescontoId === c.id,
    ).length;

  return (
    <>
      <div className="topo">
        <h1>Colaboradores</h1>
        <button type="button" className="destaque" onClick={abrirNovo}>
          + Novo colaborador
        </button>
      </div>

      <Aviso msg={aviso} onFechar={fecharAviso} />

      {erroLista && <p className="msg erro">{erroLista}</p>}
      {colaboradores === null && <p className="vazio">Carregando colaboradores...</p>}
      {colaboradores && colaboradores.length > 0 && (
        <p className="contagem">
          {colaboradores.length} {colaboradores.length === 1 ? 'colaborador' : 'colaboradores'}
        </p>
      )}
      {colaboradores && colaboradores.length === 0 && <p className="vazio">Nenhum colaborador cadastrado ainda.</p>}

      <ul className="itens">
        {(colaboradores ?? []).map((c) => {
          const decisoes = decisoesDe(c);
          const ativo = c.ativo !== false;
          return (
            <li key={c.id} className={`item ${ativo ? '' : 'inativo'}`}>
              <div className="item-topo">
                <span className="item-titulo">{c.nome}</span>
                <div className="selos">
                  {!ativo && <span className="selo desativado">Desativado</span>}
                  <span className="item-sub">ID {c.id}</span>
                </div>
              </div>
              <p className="item-info">
                CPF {formatarCpf(c.cpf)} · {c.email}
              </p>
              <p className="item-info">
                {decisoes === 0
                  ? 'Ainda não decidiu solicitações de desconto'
                  : `${decisoes} ${decisoes === 1 ? 'solicitação de desconto decidida' : 'solicitações de desconto decididas'}`}
              </p>
              <div className="acoes">
                <button type="button" className="secundario" onClick={() => abrirEditar(c)}>
                  Editar
                </button>
                {ativo ? (
                  <button type="button" className="secundario" onClick={() => setDesativando(c)}>
                    Desativar
                  </button>
                ) : (
                  <button type="button" className="secundario" disabled={processando} onClick={() => mudarAtivo(c, true)}>
                    Reativar
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        aberto={formAberto}
        titulo={editandoId === null ? 'Novo colaborador' : 'Editar colaborador'}
        onFechar={fecharForm}
        bloqueado={enviando}
      >
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
          {editandoId !== null && (
            <p className="dica">As decisões de desconto já tomadas continuam com o nome do momento da decisão.</p>
          )}
          {erroForm && <p className="msg erro">{erroForm}</p>}
          <div className="modal-acoes">
            <button type="button" className="secundario" onClick={fecharForm} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" disabled={enviando}>
              {enviando ? 'Salvando...' : editandoId === null ? 'Cadastrar colaborador' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmarModal
        aberto={desativando !== null}
        titulo="Desativar colaborador?"
        textoConfirmar="Desativar"
        carregando={processando}
        onConfirmar={() => desativando && mudarAtivo(desativando, false)}
        onCancelar={cancelarDesativar}
      >
        {desativando && (
          <>
            <p>
              <strong>{desativando.nome}</strong>
            </p>
            <p>
              O colaborador não pode mais aprovar nem rejeitar descontos. As decisões que ele já tomou continuam no
              histórico, e o cadastro pode ser reativado depois.
            </p>
          </>
        )}
      </ConfirmarModal>
    </>
  );
}
