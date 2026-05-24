'use client';

import { useEffect } from 'react';

export interface Toast {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning';
}

interface Props {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export default function ToastNotification({ toasts, onRemove }: Props) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const bg =
    toast.type === 'success' ? 'bg-green-600/90' :
    toast.type === 'warning' ? 'bg-amber-600/90' :
    'bg-[#1e2a5e]/90';

  return (
    <div className={`${bg} border border-white/20 text-white text-sm px-4 py-2.5 rounded-lg
                     shadow-lg backdrop-blur-sm max-w-xs pointer-events-auto
                     animate-in slide-in-from-right duration-300`}>
      {toast.message}
    </div>
  );
}
