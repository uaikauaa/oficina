import { BatteryCharging, Package, Plug, Wrench, Zap, type LucideIcon } from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  MAQUINA_SOLDA: Zap, GERADOR_ENERGIA: BatteryCharging, OUTRO_EQUIPAMENTO: Wrench,
  PECA: Plug, CONSUMIVEL: Zap, PRODUTO: Package, SERVICO: Wrench,
};

/** Ícones de apresentação. Os valores de domínio e contratos HTTP permanecem intactos. */
export default function DomainIcon({ type, className = 'w-4 h-4' }: { type: string; className?: string }) {
  const Icon = icons[type] ?? Package;
  return <Icon aria-hidden="true" className={className} />;
}
