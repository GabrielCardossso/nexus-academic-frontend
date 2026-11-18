import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Aviso from '../components/comum/Aviso';
import ConfirmarModal from '../components/comum/ConfirmarModal';
import Modal from '../components/comum/Modal';
import Selecao from '../components/comum/Selecao';
import { cadastrarCliente, definirClienteAtivo, editarCliente, listarClientes } from '../services/api';
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
  const [clientes, setClientes] = useState<ClienteListarResponse[] | null>(null); // null = carregando
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Mensagem>(null); // mensagem de sucesso na tela

  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null); // null = cadastro novo
  const [form, setForm] = useState(FORM_VAZIO);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [desativando, setDesativando] = useState<ClienteListarResponse | null>(null); // popup de confirmação
  const [processando, setProcessando] = useState(false);

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
    setEditandoId(null);
    setErroForm(null);
    setFormAberto(true);
  }

  function abrirEditar(c: ClienteListarResponse) {
    setForm({
      name: c.name,
      cnpj: c.cnpj ?? '',
      telefone: c.telefone ?? '',
      email: c.email,
      categoria: c.categoria,
      limiteCredito: String(c.limiteCredito),
    });
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
      const dados = { ...form, limiteCredito: Number(form.limiteCredito) };
      if (editandoId === null) await cadastrarCliente(dados);
      else await editarCliente(editandoId, dados);
      setAviso({
        tipo: 'sucesso',
        texto: `Cliente "${form.name.trim()}" ${editandoId === null ? 'cadastrado' : 'atualizado'}!`,
      });
      setFormAberto(false);
      await carregar();
    } catch (err) {
      setErroForm((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function mudarAtivo(c: ClienteListarResponse, ativo: boolean) {
    setAviso(null);
    setProcessando(true);
    try {
      await definirClienteAtivo(c.id, ativo);
      setAviso({ tipo: 'sucesso', texto: `Cliente "${c.name}" ${ativo ? 'reativado' : 'desativado'}.` });
      await carregar();
    } catch (err) {
      setAviso({ tipo: 'erro', texto: (err as Error).message });
    } finally {
      setProcessando(false);
      setDesativando(null);
    }
  }

  return (
    <>
      <div className="topo">
        <h1>Clientes</h1>
        <button type="button" onClick={abrirNovo}>
          + Novo cliente
        </button>
      </div>

      <Aviso msg={aviso} onFechar={fecharAviso} />

      {erroLista && <p className="msg erro">{erroLista}</p>}
      {clientes === null && <p className="vazio">Carregando clientes...</p>}
      {clientes && clientes.length > 0 && (
        <p className="contagem">
          {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
        </p>
      )}
      {clientes && clientes.length === 0 && <p className="vazio">Nenhum cliente cadastrado ainda.</p>}

      <ul className="itens">
        {(clientes ?? []).map((c) => {
          const ativo = c.ativo !== false;
          return (
            <li key={c.id} className={`item ${ativo ? '' : 'inativo'}`}>
              <div className="item-topo">
                <span className="item-titulo">{c.name}</span>
                <div className="selos">
                  {!ativo && <span className="selo desativado">Desativado</span>}
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
        titulo={editandoId === null ? 'Novo cliente' : 'Editar cliente'}
        onFechar={fecharForm}
        bloqueado={enviando}
      >
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
              <Selecao
                value={form.categoria}
                onChange={(categoria) => setForm((f) => ({ ...f, categoria }))}
                opcoes={[
                  { valor: 'NORMAL', rotulo: 'Normal' },
                  { valor: 'VIP', rotulo: 'VIP', detalhe: '5% automático' },
                ]}
              />
            </label>
            <label className="campo">
              <span>{editandoId === null ? 'Limite de crédito (R$)' : 'Limite de crédito disponível (R$)'}</span>
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
          {editandoId !== null && (
            <p className="dica">
              Os pedidos já feitos continuam com o nome e a categoria do momento do pedido.
            </p>
          )}
          {erroForm && <p className="msg erro">{erroForm}</p>}
          <div className="modal-acoes">
            <button type="button" className="secundario" onClick={fecharForm} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" disabled={enviando}>
              {enviando ? 'Salvando...' : editandoId === null ? 'Cadastrar cliente' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmarModal
        aberto={desativando !== null}
        titulo="Desativar cliente?"
        textoConfirmar="Desativar"
        carregando={processando}
        onConfirmar={() => desativando && mudarAtivo(desativando, false)}
        onCancelar={cancelarDesativar}
      >
        {desativando && (
          <>
            <p>
              <strong>{desativando.name}</strong>
            </p>
            <p>
              O cliente não aparece mais para novos pedidos. Os pedidos dele continuam na lista e o cadastro pode ser
              reativado depois.
            </p>
          </>
        )}
      </ConfirmarModal>
    </>
  );
}
