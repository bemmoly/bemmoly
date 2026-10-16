import { ToastProvider } from '@bemmoly/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { createQueryClient } from './lib/api.ts';
import { createPipelinesRouter } from './router.tsx';

const queryClient = createQueryClient();
const router = createPipelinesRouter(queryClient);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}
