import { useMemo, useRef, useState } from 'preact/hooks';

/** ref={boxRef}で渡せる関数。boxRef.currentで実DOMノードにもアクセスできる。 */
export interface BoxRef<T extends HTMLElement> {
  (node: T | null): void;
  current: T | null;
}

/**
 * ResizeObserverで要素の実寸を追う。初回描画やウィンドウ幅変更でも{0,0}のままにならない。
 * コールバックrefにしているのは、要素が後から条件付きで現れる場合(例: ボードを開いた後にだけ
 * 描画される作業面)でも、そのタイミングで確実にResizeObserverを付け直すため。
 * useRef+`useEffect(() => {...}, [])`だと、初回コミット時に要素がまだ無いとその後一生付かない。
 */
export function useBoxSize<T extends HTMLElement>(): [BoxRef<T>, { width: number; height: number }] {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useMemo(() => {
    const callback = ((node: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      callback.current = node;
      if (!node) return;
      const observer = new ResizeObserver(([entry]) => {
        const box = entry.contentRect;
        setSize({ width: box.width, height: box.height });
      });
      observer.observe(node);
      observerRef.current = observer;
    }) as BoxRef<T>;
    callback.current = null;
    return callback;
  }, []);

  return [ref, size];
}
