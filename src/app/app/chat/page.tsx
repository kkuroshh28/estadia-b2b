import { datosChat } from "@/server/datos/paneles";
import { ChatCliente } from "./chat-cliente";

export default async function ChatInterno() {
  const datos = await datosChat();
  return <ChatCliente datos={datos} />;
}
