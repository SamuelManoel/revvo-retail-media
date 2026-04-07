"use client";

import { RouterProvider } from "@heroui/react";
import { useRouter } from "next/navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  const { push } = useRouter();
  return <RouterProvider navigate={push}>{children}</RouterProvider>;
}
