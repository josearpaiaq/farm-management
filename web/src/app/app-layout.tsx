import {
  Dna,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PawPrint,
  Tractor,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useLogout, useMe } from '@/features/auth/api';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', key: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/animals', key: 'nav.animals', icon: PawPrint },
  { to: '/farms', key: 'nav.farms', icon: Tractor },
  { to: '/breeds', key: 'nav.breeds', icon: Dna },
  { to: '/imports', key: 'nav.imports', icon: Upload },
] as const;

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {NAV_ITEMS.map(({ to, key, icon: Icon, ...rest }) => (
        <NavLink
          key={to}
          to={to}
          end={'end' in rest}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sidebar-foreground transition-colors hover:bg-sidebar-accent',
              isActive && 'bg-sidebar-accent font-medium text-sidebar-primary',
            )
          }
        >
          <Icon className="size-5 shrink-0" aria-hidden />
          {t(key)}
        </NavLink>
      ))}
    </nav>
  );
}

function UserSection() {
  const { t } = useTranslation();
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2 border-t p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{me.data?.full_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {me.data?.email}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('auth.logout')}
        onClick={() =>
          logout.mutate(undefined, {
            onSettled: () => void navigate('/login', { replace: true }),
          })
        }
      >
        <LogOut className="size-5" />
      </Button>
    </div>
  );
}

export default function AppLayout() {
  const { t } = useTranslation();
  const me = useMe();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (me.isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (me.isError) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-svh">
      {/* Desktop: fixed sidebar (>= md, per approved nav-shell mockup). */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <span className="font-heading text-lg font-semibold">
            {t('app.title')}
          </span>
        </div>
        <Nav />
        <UserSection />
      </aside>

      {/* Mobile: top bar with a drawer. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-sidebar px-2 md:hidden">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('nav.menu')}>
              <Menu className="size-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col p-0">
            <SheetHeader className="border-b">
              <SheetTitle className="text-left font-heading">
                {t('app.title')}
              </SheetTitle>
            </SheetHeader>
            <Nav onNavigate={() => setDrawerOpen(false)} />
            <UserSection />
          </SheetContent>
        </Sheet>
        <span className="font-heading font-semibold">{t('app.title')}</span>
      </header>

      <main className="p-4 md:p-6 md:pl-66">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
