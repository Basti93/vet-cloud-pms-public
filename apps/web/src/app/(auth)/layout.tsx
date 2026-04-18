import { ClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
