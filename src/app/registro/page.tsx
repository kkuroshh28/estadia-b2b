import { hayDb } from "@/server/datos/fuente";
import { RegistroCliente } from "./registro-cliente";

export default function PaginaRegistro() {
  return <RegistroCliente real={hayDb()} />;
}
