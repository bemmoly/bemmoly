import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useThemeEffect } from './hooks/use-theme-effect.ts';
import { createQueryClient } from './lib/api.ts';
import { createAppRouter } from './router.tsx';

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);

function ThemedRouter() {
  useThemeEffect();
  return <RouterProvider router={router} />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemedRouter />
    </QueryClientProvider>
  );
}
