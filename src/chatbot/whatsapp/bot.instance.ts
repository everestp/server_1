import { WhatsAppBot } from "./whatsapp.bot";

let botInstance: WhatsAppBot | null = null;

export const setWhatsAppBotInstance = (bot: WhatsAppBot): void => {
  botInstance = bot;
};

export const getWhatsAppBotInstance = (): WhatsAppBot => {
  if (!botInstance) {
    throw new Error("WhatsAppBot instance not initialized");
  }
  return botInstance;
};
