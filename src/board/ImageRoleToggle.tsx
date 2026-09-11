import { updateBoard } from '../state';
import type { ImageRole } from '../schema';

/** H4: 「この画像は?」をボード上端に常時置く(貼った直後は既定でdraftのまま、あとから切替可能)。 */
export function ImageRoleToggle({ role }: { role: ImageRole | null }) {
  return (
    <div class="lens-toggle image-role-toggle">
      <button class={`btn-sm${role === 'draft' ? ' is-active' : ''}`} onClick={() => updateBoard((b) => ({ ...b, imageRole: 'draft' }))}>
        直したい
      </button>
      <button class={`btn-sm${role === 'reference' ? ' is-active' : ''}`} onClick={() => updateBoard((b) => ({ ...b, imageRole: 'reference' }))}>
        参考
      </button>
    </div>
  );
}
