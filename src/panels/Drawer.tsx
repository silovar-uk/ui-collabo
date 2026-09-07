import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface Props {
  onClose: () => void;
  header: ComponentChildren;
  children: ComponentChildren;
  ariaLabel: string;
}

/** 「AIに渡す」「ルール」「ライブラリ」で共有する右からスライドインするドロワーの枠。 */
export function Drawer({ onClose, header, children, ariaLabel }: Props) {
  const firstTabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    firstTabRef.current?.querySelector<HTMLElement>('button, [href], input, [tabindex]')?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div class="drawer-backdrop" onClick={onClose}>
      <div class="drawer" role="dialog" aria-modal="true" aria-label={ariaLabel} onClick={(e) => e.stopPropagation()}>
        <div class="drawer-header">
          <div class="drawer-tabs" ref={firstTabRef}>{header}</div>
          <button class="btn-sm" onClick={onClose}>閉じる</button>
        </div>
        {children}
      </div>
    </div>
  );
}
