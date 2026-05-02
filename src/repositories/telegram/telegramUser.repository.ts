import { ITelegramUser, TelegramUser } from "../../models/telegram/telegramUser.model";

/**
 * Telegram user repository
 */
export class TelegramUserRepository {
  /**
   * Find user by telegram id
   *
   * @param telegramId - telegram user id
   * @returns user document or null
   */
  async findByTelegramId(
    telegramId: string
  ): Promise<ITelegramUser | null> {
    return TelegramUser.findOne({ telegramId });
  }

  /**
   * Create new telegram user
   *
   * @param data.telegramId - telegram user id
   * @param data.username - telegram username (optional)
   * @returns created user document
   */
  async create(data: {
    telegramId: string;
    username?: string;
  }): Promise<ITelegramUser> {
    return TelegramUser.create({
      telegramId: data.telegramId,
      username: data.username,
      isPremium: false,
      remainingRequests: 0,
      totalMessagesUsed: 0,
      dailyUsage: 0,
    });
  }

  /**
   * Update user location
   *
   * @param telegramId - telegram user id
   * @param lat - latitude
   * @param lng - longitude
   */
  async updateLocation(
    telegramId: string,
    lat: number,
    lng: number
  ): Promise<void> {
    await TelegramUser.updateOne(
      { telegramId },
      { $set: { "location.lat": lat, "location.lng": lng } }
    );
  }

  /**
   * Increment total message usage
   *
   * @param telegramId - telegram user id
   */
  async incrementUsage(telegramId: string): Promise<void> {
    await TelegramUser.updateOne(
      { telegramId },
      { $inc: { totalMessagesUsed: 1 } }
    );
  }

  /**
   * Increment daily usage (with optional reset)
   *
   * @param telegramId - telegram user id
   * @param resetDay - reset daily counter if true
   */
  async incrementDailyUsage(
    telegramId: string,
    resetDay: boolean
  ): Promise<void> {
    const update: any = { $inc: { dailyUsage: 1 } };

    if (resetDay) {
      update.$set = {
        dailyUsage: 1,
        lastDailyReset: new Date(),
      };
      delete update.$inc;
    }

    await TelegramUser.updateOne({ telegramId }, update);
  }

  /**
   * Decrease remaining requests
   *
   * @param telegramId - telegram user id
   */
  async decrementRequests(telegramId: string): Promise<void> {
    await TelegramUser.updateOne(
      { telegramId },
      { $inc: { remainingRequests: -1 } }
    );
  }

  /**
   * Upgrade user to premium
   *
   * @param telegramId - telegram user id
   * @param requests - extra requests to add
   */
  async upgradeToPremium(
    telegramId: string,
    requests: number
  ): Promise<void> {
    await TelegramUser.updateOne(
      { telegramId },
      {
        $set: { isPremium: true },
        $inc: { remainingRequests: requests },
      }
    );
  }
}
