import { AsyncLocalStorage } from 'async_hooks';

export interface AuthContext {
  rowId: string;
  timezone: string;
}

export const authContext = new AsyncLocalStorage<AuthContext>();
