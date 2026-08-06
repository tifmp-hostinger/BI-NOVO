import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

type Props = {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon = Inbox, title, message, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-paper p-10 text-center animate-fade-in">
      <div className="rounded-full bg-white p-3 shadow-card">
        <Icon className="h-6 w-6 text-sand" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1 max-w-md text-xs text-ink-3">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
