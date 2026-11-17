import { useEffect, useRef, type ReactNode } from 'react';

interface ConfirmarModalProps {
  aberto: boolean;
  titulo: string;
  children: ReactNode;
  textoConfirmar: string;
  textoCancelar?: string;
  carregando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/** Popup de confirmação: Esc ou clique fora cancelam; foco inicial no botão de cancelar. */
export default function ConfirmarModal({
  aberto,
  titulo,
  children,
  textoConfirmar,
  textoCancelar = 'Cancelar',
  carregando = false,
  onConfirmar,
  onCancelar,
}: ConfirmarModalProps) {
  const cancelarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    cancelarRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !carregando) onCancelar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, carregando, onCancelar]);

  if (!aberto) return null;

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && !carregando && onCancelar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <h2 id="modal-titulo">{titulo}</h2>
        <div className="modal-corpo">{children}</div>
        <div className="modal-acoes">
          <button type="button" className="secundario" ref={cancelarRef} onClick={onCancelar} disabled={carregando}>
            {textoCancelar}
          </button>
          <button type="button" className="rejeitar" onClick={onConfirmar} disabled={carregando}>
            {carregando ? 'Aguarde...' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
