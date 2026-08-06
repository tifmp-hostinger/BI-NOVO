import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { GripVertical } from 'lucide-react';

type ItemProps = { rid: string; className?: string; children: ReactNode };

/**
 * Marcador declarativo de item reordenável — só carrega props; quem renderiza
 * é o ReorderableGrid pai.
 */
export function RItem(props: ItemProps) {
  void props;
  return null;
}

/**
 * Grid cujos itens o usuário pode reordenar arrastando pelo punho (⋮⋮) que
 * aparece no topo de cada card. A ordem é salva em localStorage por
 * `storageKey`, então cada usuário mantém a sua própria organização.
 */
export function ReorderableGrid({
  storageKey,
  className,
  children,
}: {
  storageKey: string;
  className: string;
  children: ReactNode;
}) {
  const items = useMemo(() => {
    const out: ItemProps[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === RItem) {
        out.push(child.props as ItemProps);
      }
    });
    return out;
  }, [children]);

  const idsKey = items.map((i) => i.rid).join('|');
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const wrapperRefs = useRef(new Map<string, HTMLDivElement | null>());

  useEffect(() => {
    let stored: string[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) stored = JSON.parse(raw) as string[];
    } catch {
      stored = [];
    }
    const ids = idsKey ? idsKey.split('|') : [];
    setOrder([
      ...stored.filter((id) => ids.includes(id)),
      ...ids.filter((id) => !stored.includes(id)),
    ]);
  }, [storageKey, idsKey]);

  // Memoizado: dragId/overId mudam a cada evento de dragover (vários por
  // segundo durante o arraste) sem afetar a ordem em si — sem isso, o
  // O(n) .find() por item rodava de novo a cada evento à toa.
  const sorted = useMemo(
    () => order.map((id) => items.find((i) => i.rid === id)).filter((i): i is ItemProps => !!i),
    [order, items],
  );

  const drop = (targetId: string) => {
    setOverId(null);
    if (!dragId || dragId === targetId) return;
    const next = order.filter((id) => id !== dragId);
    next.splice(next.indexOf(targetId), 0, dragId);
    setOrder(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // localStorage indisponível (modo privado) — a ordem vale só na sessão.
    }
  };

  return (
    <section className={className}>
      {sorted.map((item) => (
        <div
          key={item.rid}
          ref={(el) => {
            wrapperRefs.current.set(item.rid, el);
          }}
          className={`group/reorder relative ${item.className ?? ''} ${
            dragId === item.rid ? 'opacity-50' : ''
          } ${
            overId === item.rid && dragId && dragId !== item.rid
              ? 'rounded-md ring-2 ring-fmp/60'
              : ''
          }`}
          onDragOver={(e) => {
            if (dragId) {
              e.preventDefault();
              setOverId(item.rid);
            }
          }}
          onDragLeave={() => {
            if (overId === item.rid) setOverId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            drop(item.rid);
          }}
        >
          <button
            type="button"
            draggable
            aria-label="Arrastar para reordenar este card"
            title="Arrastar para reordenar"
            className="absolute left-1/2 top-1.5 z-10 -translate-x-1/2 cursor-grab rounded-sm p-1 text-ink-3 opacity-0 transition hover:bg-paper focus:opacity-100 group-hover/reorder:opacity-100 active:cursor-grabbing"
            onDragStart={(e) => {
              setDragId(item.rid);
              const el = wrapperRefs.current.get(item.rid);
              if (el) e.dataTransfer.setDragImage(el, 24, 24);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
          >
            <GripVertical className="h-3.5 w-3.5 rotate-90" />
          </button>
          {item.children}
        </div>
      ))}
    </section>
  );
}
