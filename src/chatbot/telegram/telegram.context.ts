import { Context, SessionFlavor } from "grammy";

export interface SessionData {
  awaitingLocation: boolean;
  locationAsked: boolean;
}

export type BotContext = Context & SessionFlavor<SessionData>;
