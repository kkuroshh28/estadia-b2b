import { protegerSeccion } from "@/server/auth/guardia";

export default async function LayoutPrincipal({ children }: { children: React.ReactNode }) {
  await protegerSeccion("principal");
  return <>{children}</>;
}
