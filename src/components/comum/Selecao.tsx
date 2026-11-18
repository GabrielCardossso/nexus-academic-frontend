import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface Opcao<T extends string> {
  valor: T;
  rotulo: string;
  detalhe?: string; // texto menor à direita (ex.: "VIP", "indisponível")
  desabilitada?: boolean;
}

interface SelecaoProps<T extends string> {
  value: T;
  onChange: (valor: T) => void;
  opcoes: Opcao<T>[];
  placeholder?: string; // mostrado quando nenhuma opção tem o valor atual
  disabled?: boolean;
  'aria-label'?: string;
}

const ALTURA_MAX = 260; // px da lista aberta

/**
 * Caixa de seleção própria (o <select> nativo não deixa estilizar a lista aberta).
 * Teclado: setas, Home/End, Enter/Espaço escolhem, Esc/Tab fecham, letra pula para a opção.
 * A lista abre com position: fixed para não ser cortada dentro do popup.
 */
export default function Selecao<T extends string>({
  value,
  onChange,
  opcoes,
  placeholder = 'Selecione',
  disabled = false,
  'aria-label': ariaLabel,
}: SelecaoProps<T>) {
  const id = useId();
  const botaoRef = useRef<HTMLButtonElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(-1); // índice destacado pelo teclado/mouse
  const [posicao, setPosicao] = useState<{ top: number; left: number; width: number; paraCima: boolean }>();

  const selecionada = opcoes.find((o) => o.valor === value);
  const habilitadas = opcoes.map((o, i) => (o.desabilitada ? -1 : i)).filter((i) => i >= 0);

  function abrir() {
    if (disabled) return;
    const atual = opcoes.findIndex((o) => o.valor === value && !o.desabilitada);
    setAtiva(atual >= 0 ? atual : (habilitadas[0] ?? -1));
    setAberta(true);
  }

  function escolher(i: number) {
    const o = opcoes[i];
    if (!o || o.desabilitada) return;
    onChange(o.valor);
    setAberta(false);
    botaoRef.current?.focus();
  }

  // Posição da lista: embaixo do botão, ou em cima se não couber.
  useLayoutEffect(() => {
    if (!aberta || !botaoRef.current) return;
    const r = botaoRef.current.getBoundingClientRect();
    const paraCima = window.innerHeight - r.bottom < Math.min(ALTURA_MAX, opcoes.length * 40) + 8 && r.top > window.innerHeight - r.bottom;
    setPosicao({ top: paraCima ? r.top - 4 : r.bottom + 4, left: r.left, width: r.width, paraCima });
  }, [aberta, opcoes.length]);

  // Fecha ao clicar fora, ao rolar a página (fora da lista) ou ao redimensionar.
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!botaoRef.current?.contains(alvo) && !listaRef.current?.contains(alvo)) setAberta(false);
    };
    const rolou = (e: Event) => {
      if (!listaRef.current?.contains(e.target as Node)) setAberta(false);
    };
    const fechar = () => setAberta(false);
    document.addEventListener('mousedown', fora);
    window.addEventListener('scroll', rolou, true);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', fora);
      window.removeEventListener('scroll', rolou, true);
      window.removeEventListener('resize', fechar);
    };
  }, [aberta]);

  // Mantém a opção destacada visível na lista.
  useEffect(() => {
    if (aberta && ativa >= 0) {
      listaRef.current?.querySelector<HTMLElement>(`[data-indice="${ativa}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [aberta, ativa]);

  function mover(passo: number) {
    if (habilitadas.length === 0) return;
    const pos = habilitadas.indexOf(ativa);
    const proxima = pos < 0 ? 0 : Math.min(Math.max(pos + passo, 0), habilitadas.length - 1);
    setAtiva(habilitadas[proxima]);
  }

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>) {
    if (!aberta) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        mover(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        mover(-1);
        break;
      case 'Home':
        e.preventDefault();
        setAtiva(habilitadas[0] ?? -1);
        break;
      case 'End':
        e.preventDefault();
        setAtiva(habilitadas[habilitadas.length - 1] ?? -1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        escolher(ativa);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation(); // fecha só a lista, não o popup em volta
        setAberta(false);
        break;
      case 'Tab':
        setAberta(false);
        break;
      default:
        // Letra: pula para a próxima opção que começa com ela.
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const letra = e.key.toLowerCase();
          const depois = [...habilitadas.filter((i) => i > ativa), ...habilitadas.filter((i) => i <= ativa)];
          const achou = depois.find((i) => opcoes[i].rotulo.toLowerCase().startsWith(letra));
          if (achou !== undefined) setAtiva(achou);
        }
    }
  }

  return (
    <div className={`selecao ${aberta ? 'aberta' : ''}`}>
      <button
        ref={botaoRef}
        type="button"
        className="selecao-botao"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={aberta}
        aria-controls={`${id}-lista`}
        aria-activedescendant={aberta && ativa >= 0 ? `${id}-${ativa}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (aberta ? setAberta(false) : abrir())}
        onKeyDown={aoTeclar}
      >
        <span className={selecionada ? 'selecao-valor' : 'selecao-placeholder'}>
          {selecionada ? selecionada.rotulo : placeholder}
        </span>
        <svg className="selecao-seta" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {aberta && posicao && (
        <ul
          ref={listaRef}
          id={`${id}-lista`}
          className="selecao-lista"
          role="listbox"
          style={{
            top: posicao.top,
            left: posicao.left,
            width: posicao.width,
            maxHeight: ALTURA_MAX,
            transform: posicao.paraCima ? 'translateY(-100%)' : undefined,
          }}
        >
          {opcoes.map((o, i) => (
            <li
              key={o.valor}
              id={`${id}-${i}`}
              data-indice={i}
              role="option"
              aria-selected={o.valor === value}
              aria-disabled={o.desabilitada || undefined}
              className={`selecao-opcao ${i === ativa ? 'ativa' : ''} ${o.valor === value ? 'escolhida' : ''}`}
              onMouseEnter={() => !o.desabilitada && setAtiva(i)}
              onMouseDown={(e) => e.preventDefault()} // não tira o foco do botão
              onClick={() => escolher(i)}
            >
              <span>{o.rotulo}</span>
              {o.detalhe && <small>{o.detalhe}</small>}
              {o.valor === value && (
                <svg className="selecao-check" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
