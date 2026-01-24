
export interface IStorage {
  // No storage needed for this stateless app
}

export class MemStorage implements IStorage {
  constructor() {}
}

export const storage = new MemStorage();
