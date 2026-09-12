import { toast } from '../state';

/** S5: 箇所削除など元に戻せる操作を5秒だけ知らせる。 */
export function Toast() {
  if (!toast.value) return null;
  const { message, onUndo } = toast.value;
  return (
    <div class="toast">
      <span>{message}</span>
      {onUndo && (
        <button
          class="btn-sm"
          onClick={() => {
            onUndo();
            toast.value = null;
          }}
        >
          元に戻す
        </button>
      )}
    </div>
  );
}
