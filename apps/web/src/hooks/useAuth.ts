import { useContext } from 'react';
import { AuthContext } from '../providers/auth-context';

export function useAuth() {
  return useContext(AuthContext);
}
