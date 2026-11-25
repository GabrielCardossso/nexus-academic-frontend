import type { ReactNode } from 'react';

/** "+" desenhado em SVG (fica certinho no centro, em qualquer fonte). */
function Mais({ className }: { className: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

interface BotaoDestaqueProps {
  children: ReactNode;
  onClick: () => void;
}

/**
 * Botão principal da tela ("+ Novo ...").
 * PC: estilo "flow button" (inspirado no FlowButton do 21st.dev): pílula clara com o "+" à direita; no
 * hover o fundo escuro preenche a partir do mouse (utils/preenchimentoHover.ts), os cantos ficam
 * mais retos e o "+" sai pela direita enquanto outro entra pela esquerda, empurrando o texto.
 * Celular: vira o círculo de vidro flutuante do topo (só o "+", desenhado no CSS).
 */
export default function BotaoDestaque({ children, onClick }: BotaoDestaqueProps) {
  return (
    <button type="button" className="destaque" onClick={onClick}>
      <Mais className="destaque-icone entra" />
      <span className="destaque-rotulo">{children}</span>
      <Mais className="destaque-icone sai" />
    </button>
  );
}
