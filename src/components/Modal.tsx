import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  aberto: boolean;
  titulo: string;
  children: ReactNode;
  onFechar: () => void;
  /** Enquanto true (ex.: salvando), Esc, clique fora e o "×" não fecham. */
  bloqueado?: boolean;
  larga?: boolean;
}

/** Janela por cima da tela: Esc, clique fora ou "×" fecham. Foca o primeiro campo ao abrir. */
export default function Modal({ aberto, titulo, children, onFechar, bloqueado = false, larga = false }: ModalProps) {
  const caixaRef = useRef<HTMLDivElement>(null);

  // Foco inicial: só quando abre (não a cada render).
  useEffect(() => {
    if (!aberto) return;
    const primeiro = caixaRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not(.modal-fechar)',
    );
    primeiro?.focus();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !bloqueado) onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, bloqueado, onFechar]);

  if (!aberto) return null;

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && !bloqueado && onFechar()}>
      <div
        ref={caixaRef}
        className={`modal ${larga ? 'larga' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
      >
        <div className="modal-topo">
          <h2 id="modal-titulo">{titulo}</h2>
          <button type="button" className="modal-fechar" onClick={onFechar} disabled={bloqueado} aria-label="Fechar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
