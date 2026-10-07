import { Outlet } from '@tanstack/react-router';
import { ThemeSwitcher } from '../components/theme-switcher.tsx';
import { TopBar } from '../components/top-bar.tsx';
import { useModules } from '../hooks/use-modules.ts';

export function RootLayout() {
  const { data: modules = [] } = useModules();
  const entries = modules.flatMap((module) =>
    module.navigation.filter((entry) => entry.placement === 'top'),
  );
  return (
    <div className="flex h-screen flex-col bg-bg text-tx">
      <TopBar entries={entries} trailing={import.meta.env.DEV ? <ThemeSwitcher /> : null} />
      <main className="min-h-0 flex-1 overflow-auto" data-testid="main">
        <Outlet />
      </main>
    </div>
  );
}
