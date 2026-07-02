import { protegerSeccion } from "@/server/auth/guardia";

export default async function LayoutExterno({ children }: { children: React.ReactNode }) {
  await protegerSeccion("externo");
  return <>{children}</>;
}
