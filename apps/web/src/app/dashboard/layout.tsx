import { ClerkProvider } from "@clerk/nextjs";
import { ReactNode } from "react";
import DashboardContent from "./_layout-content";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <DashboardContent>{children}</DashboardContent>
    </ClerkProvider>
  );
}
