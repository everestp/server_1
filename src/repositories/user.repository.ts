import { IUser, User } from "../models/user.model";

/**
 * User repository contract
 */
export interface IUserRepository {
  findByEmail(email: string): Promise<IUser | null>;
  findById(id: string): Promise<IUser | null>;
  createUser(data: Partial<IUser>): Promise<IUser>;
}

/**
 * User repository implementation
 */
export class UserRepository implements IUserRepository {
  /**
   * Find user by email
   *
   * @param email - user email
   * @returns user document or null
   */
  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email });
  }

  /**
   * Find user by id
   *
   * @param id - user id
   * @returns user document or null
   */
  async findById(id: string): Promise<IUser | null> {
    return User.findById(id);
  }

  /**
   * Create new user
   *
   * @param data - partial user data
   * @returns created user document
   */
  async createUser(data: Partial<IUser>): Promise<IUser> {
    return User.create(data);
  }
}
