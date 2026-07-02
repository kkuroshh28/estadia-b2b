import { protegerSeccion } from "@/server/auth/guardia";

export default async function LayoutPropietario({ children }: { children: React.ReactNode }) {
  await protegerSeccion("propietario");
  return <>{children}</>;
}
