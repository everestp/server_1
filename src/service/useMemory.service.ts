type Location = { lat: number; lng: number };

const memory = new Map<string, Location>();

export class UserMemoryService {
  setLocation(userId: string, loc: Location) {
    memory.set(userId, loc);
  }

  getLocation(userId: string): Location | undefined {
    return memory.get(userId);
  }
}
