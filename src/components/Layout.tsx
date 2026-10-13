import { createContext, useContext, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { CartDrawer } from './CartDrawer';

interface CartDrawerCtx {
  open: () => void;
  close: () => void;
}
const Ctx = createContext<CartDrawerCtx>({ open: () => {}, close: () => {} });
// eslint-disable-next-line react-refresh/only-export-components
export const useCartDrawer = () => useContext(Ctx);

export function Layout({ children }: { children?: ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <Ctx.Provider value={{ open: () => setCartOpen(true), close: () => setCartOpen(false) }}>
      <div className="app-bg" aria-hidden />
      <Header onCartClick={() => setCartOpen(true)} />
      <main className="main">{children ?? <Outlet />}</main>
      <footer className="footer container">
        <span>UTown Delivery · demo frontend</span>
        <a href="https://utown-backend.onrender.com/swagger-ui/index.html" target="_blank" rel="noreferrer">
          API docs ↗
        </a>
      </footer>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </Ctx.Provider>
  );
}
