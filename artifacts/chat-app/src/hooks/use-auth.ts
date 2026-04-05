import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { recordSessionStart } from './use-session-expiry';

export interface UserSession {
  userId: string;
  username: string;
  gender: 'Male' | 'Female';
  age: number;
  country?: string;
}

export function useAuth() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const userId = sessionStorage.getItem('userId');
    const username = sessionStorage.getItem('username');
    const gender = sessionStorage.getItem('gender');
    const ageRaw = sessionStorage.getItem('age');
    const country = sessionStorage.getItem('country') ?? undefined;

    if (userId && username && gender && ageRaw) {
      const age = parseInt(ageRaw, 10);
      if (!isNaN(age)) {
        setUser({ userId, username, gender: gender as 'Male' | 'Female', age, country });
      }
    }
    setIsLoaded(true);
  }, []);

  const login = useCallback((session: UserSession) => {
    sessionStorage.setItem('userId', session.userId);
    sessionStorage.setItem('username', session.username);
    sessionStorage.setItem('gender', session.gender);
    sessionStorage.setItem('age', String(session.age));
    if (session.country) {
      sessionStorage.setItem('country', session.country);
    }
    recordSessionStart();
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.clear();
    setUser(null);
    setLocation('/');
  }, [setLocation]);

  return { user, login, logout, isLoaded };
}
