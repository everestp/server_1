import {
  IWhatsAppUser,
  WhatsAppUser,
} from "../../models/whatsapp/whatsappUser.model";

/**
 * WhatsApp user repository — mirrors TelegramUserRepository 1-to-1
 */
export class WhatsAppUserRepository {
  /**
   * Find user by WhatsApp id (phone number)
   */
  async findByWhatsAppId(
    whatsappId: string
  ): Promise<IWhatsAppUser | null> {
    return WhatsAppUser.findOne({ whatsappId });
  }

  /**
   * Create new WhatsApp user
   */
  async create(data: {
    whatsappId: string;
    username?: string;
  }): Promise<IWhatsAppUser> {
    return WhatsAppUser.create({
      whatsappId: data.whatsappId,
      username: data.username,
      isPremium: false,
      remainingRequests: 0,
      totalMessagesUsed: 0,
      dailyUsage: 0,
    });
  }

  /**
   * Update user location
   */
  async updateLocation(
    whatsappId: string,
    lat: number,
    lng: number
  ): Promise<void> {
    await WhatsAppUser.updateOne(
      { whatsappId },
      { $set: { "location.lat": lat, "location.lng": lng } }
    );
  }

  /**
   * Increment total message usage
   */
  async incrementUsage(whatsappId: string): Promise<void> {
    await WhatsAppUser.updateOne(
      { whatsappId },
      { $inc: { totalMessagesUsed: 1 } }
    );
  }

  /**
   * Increment daily usage (with optional reset)
   */
  async incrementDailyUsage(
    whatsappId: string,
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

    await WhatsAppUser.updateOne({ whatsappId }, update);
  }

  /**
   * Decrease remaining requests
   */
  async decrementRequests(whatsappId: string): Promise<void> {
    await WhatsAppUser.updateOne(
      { whatsappId },
      { $inc: { remainingRequests: -1 } }
    );
  }

  /**
   * Upgrade user to premium
   */
  async upgradeToPremium(
    whatsappId: string,
    requests: number
  ): Promise<void> {
    await WhatsAppUser.updateOne(
      { whatsappId },
      {
        $set: { isPremium: true },
        $inc: { remainingRequests: requests },
      }
    );
  }
}
