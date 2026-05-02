import { TelegramBot } from "./telegram.bot";

let botInstance: TelegramBot | null = null;

export const setBotInstance = (bot: TelegramBot): void => {
  botInstance = bot;
};

export const getBotInstance = (): TelegramBot => {
  if (!botInstance) {
    throw new Error("TelegramBot instance not initialized");
  }
  return botInstance;
};
