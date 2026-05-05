import { proto, WASocket } from "@whiskeysockets/baileys";

/**
 * Session data stored per user (in-memory)
 */
export interface WhatsAppSessionData {
  awaitingLocation: boolean;
  locationAsked: boolean;
}

/**
 * Parsed incoming message context — mirrors BotContext shape
 */
export interface WhatsAppContext {
  socket: WASocket;
  message: proto.IWebMessageInfo;
  from: string;           // JID e.g. "91XXXXXXXXXX@s.whatsapp.net"
  phoneNumber: string;    // cleaned E.164 number without suffix
  text: string | null;
  location: { latitude: number; longitude: number } | null;
  session: WhatsAppSessionData;
  reply(text: string): Promise<void>;
}
