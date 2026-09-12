import { useEffect, useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact';

/** ResizeObserverで要素の実寸を追う。初回描画やウィンドウ幅変更でも{0,0}のままにならない。 */
export function useBoxSize<T extends HTMLElement>(): [RefObject<T>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize({ width: box.width, height: box.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
