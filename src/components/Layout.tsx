import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { CartDrawer } from './CartDrawer';
import { DemoTour } from './DemoTour';
import { API_BASE_URL } from '../api/client';
import { useTheme } from '../lib/theme';

interface CartDrawerCtx {
  open: () => void;
  close: () => void;
}
const Ctx = createContext<CartDrawerCtx>({ open: () => {}, close: () => {} });
// eslint-disable-next-line react-refresh/only-export-components
export const useCartDrawer = () => useContext(Ctx);

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export function Layout() {
  const [cartOpen, setCartOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const ctx = useMemo(() => ({ open: () => setCartOpen(true), close: () => setCartOpen(false) }), []);

  return (
    <Ctx.Provider value={ctx}>
      <ScrollToTop />
      <Header onCartClick={ctx.open} theme={theme} onToggleTheme={toggle} />
      <main id="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer__inner">
          <div className="stack stack--sm">
            <span>
              <strong style={{ color: 'var(--text)' }}>utown.</strong> — a full-stack food delivery demo. Data resets are possible; nothing is charged.
            </span>
            <div className="stack-chips">
              {['React 19', 'TypeScript', 'TanStack Query', 'Spring Boot', 'MySQL', 'Redis', 'JWT'].map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          </div>
          <nav className="footer__links" aria-label="Project links">
            <a href="https://github.com/E-L-R/utown-frontend" target="_blank" rel="noreferrer">Frontend code ↗</a>
            <a href="https://github.com/E-L-R/utown-backend" target="_blank" rel="noreferrer">Backend code ↗</a>
            <a href={`${API_BASE_URL}/swagger-ui/index.html`} target="_blank" rel="noreferrer">API docs ↗</a>
          </nav>
        </div>
      </footer>
      <CartDrawer open={cartOpen} onClose={ctx.close} />
      <DemoTour />
    </Ctx.Provider>
  );
}
