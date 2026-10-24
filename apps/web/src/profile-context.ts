import { createContext } from 'react';
import type { Profile } from './profile';
export const ProfileContext = createContext<Profile | null>(null);
