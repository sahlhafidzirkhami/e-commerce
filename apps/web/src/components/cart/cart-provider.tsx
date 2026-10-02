'use client';

import type { CartView } from '@sportswear/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cartApi } from '@/lib/cart-client';

type CartStatus = 'loading' | 'ready' | 'error';

interface CartContextValue {
  cart: CartView | null;
  status: CartStatus;
  /** Muat ulang dari server (mis. setelah gagal). */
  reload: () => Promise<void>;
  /** Ganti isi keranjang dengan respons terbaru dari API. */
  setCart: (cart: CartView) => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCartState] = useState<CartView | null>(null);
  const [status, setStatus] = useState<CartStatus>('loading');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      setCartState(await cartApi.get());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setCart = useCallback((next: CartView) => {
    setCartState(next);
    setStatus('ready');
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      status,
      reload,
      setCart,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    }),
    [cart, status, reload, setCart, drawerOpen],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart harus dipakai di dalam CartProvider');
  return value;
}
