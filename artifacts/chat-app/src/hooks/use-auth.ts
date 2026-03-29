import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';

export interface UserSession {
  userId: string;
  username: string;
  gender: 'Male' | 'Female';
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
    const country = sessionStorage.getItem('country') ?? undefined;

    if (userId && username && gender) {
      setUser({ userId, username, gender: gender as 'Male' | 'Female', country });
    }
    setIsLoaded(true);
  }, []);

  const login = useCallback((session: UserSession) => {
    sessionStorage.setItem('userId', session.userId);
    sessionStorage.setItem('username', session.username);
    sessionStorage.setItem('gender', session.gender);
    if (session.country) {
      sessionStorage.setItem('country', session.country);
    }
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.clear();
    setUser(null);
    setLocation('/');
  }, [setLocation]);

  return { user, login, logout, isLoaded };
}
