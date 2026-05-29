"use client";

import { useState } from "react";
import { httpBatchLink } from "@trpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { queryClient, getBaseUrl } from "@/lib/trpc-client";
import { GlobalQueryActivity } from "@/components/global-query-activity";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          // Browser calls same-origin /api/trpc. Cookies are included automatically.
          // The route handler reads the Clerk session server-side and adds the
          // Authorization header before forwarding to the web app.
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <GlobalQueryActivity />
        {children}
      </trpc.Provider>
    </QueryClientProvider>
  );
}
