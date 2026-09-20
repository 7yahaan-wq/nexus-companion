import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../domain/i18n';
export default function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const close = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener('cancel', close);
    return () => {
      dialog.removeEventListener('cancel', close);
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.target === e.currentTarget &&
          (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        )
          onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{t(title)}</h2>
        <button type="button" aria-label="关闭" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
