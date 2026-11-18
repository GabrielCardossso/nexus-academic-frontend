import { useEffect } from 'react';
import type { Mensagem } from '../../utils';

interface AvisoProps {
  msg: Mensagem;
  onFechar: () => void;
}

/** Aviso flutuante no canto da tela; some sozinho depois de alguns segundos. */
export default function Aviso({ msg, onFechar }: AvisoProps) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onFechar, msg.tipo === 'erro' ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [msg, onFechar]);

  if (!msg) return null;

  return (
    <div className={`aviso-flutuante ${msg.tipo}`} role={msg.tipo === 'erro' ? 'alert' : 'status'}>
      <span>{msg.texto}</span>
      <button type="button" onClick={onFechar} aria-label="Fechar aviso">
        ×
      </button>
    </div>
  );
}
