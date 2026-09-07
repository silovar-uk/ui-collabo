import type { ComponentChildren } from 'preact';

interface Props {
  onClose: () => void;
  header: ComponentChildren;
  children: ComponentChildren;
}

/** 「AIに渡す」「ルール」「ライブラリ」で共有する右からスライドインするドロワーの枠。 */
export function Drawer({ onClose, header, children }: Props) {
  return (
    <div class="drawer-backdrop" onClick={onClose}>
      <div class="drawer" onClick={(e) => e.stopPropagation()}>
        <div class="drawer-header">
          <div class="drawer-tabs">{header}</div>
          <button class="btn-sm" onClick={onClose}>閉じる</button>
        </div>
        {children}
      </div>
    </div>
  );
}
