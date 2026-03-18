import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const sizeClassMap = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function AppModal({
  open,
  onClose,
  title,
  icon = null,
  size = 'md',
  footer = null,
  children,
  bodyClassName = '',
  panelClassName = '',
  closeOnOverlay = true,
}) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]"
      onClick={(event) => {
        if (closeOnOverlay && event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className={`w-full ${sizeClassMap[size] || sizeClassMap.md} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            {icon ? <span className="text-slate-600">{icon}</span> : null}
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className={`px-6 py-5 ${bodyClassName}`}>{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
