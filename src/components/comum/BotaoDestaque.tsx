import type { ReactNode } from 'react';

interface BotaoDestaqueProps {
  children: ReactNode;
  onClick: () => void;
}

/**
 * Botão principal da tela ("+ Novo ...").
 * PC: botão azul com o hover que preenche a partir do mouse (utils/preenchimentoHover.ts, do hora-control).
 * Celular: vira o círculo de vidro flutuante do topo (só o "+", desenhado no CSS; o texto fica só para o
 * leitor de tela).
 */
export default function BotaoDestaque({ children, onClick }: BotaoDestaqueProps) {
  return (
    <button type="button" className="destaque" onClick={onClick}>
      <span className="destaque-rotulo">+ {children}</span>
    </button>
  );
}
