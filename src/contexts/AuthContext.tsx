import { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  updated_at: string | null;
  role_id: string | null;
  admin_id: string | null;
  requires_password_change: boolean;
  needs_onboarding: boolean;
  email: string | null;
  permissions: string[];
}

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  token: string | null;
  login: (body: any) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('authToken'));
  const navigate = useNavigate();

  const refreshProfile = useCallback(async () => {
    const currentToken = token || localStorage.getItem('authToken');
    if (!currentToken) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const { profile: fetchedProfile } = await res.json();
        setProfile(fetchedProfile);
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('authToken');
        setToken(null);
        setProfile(null);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      localStorage.removeItem('authToken');
      setToken(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const handleAuthSuccess = (data: { token: string; profile: Profile }) => {
    localStorage.setItem('authToken', data.token);
    setToken(data.token);
    setProfile(data.profile);
    navigate('/');
    return { success: true };
  };

  const handleAuthError = async (res: Response) => {
    const errorData = await res.json();
    return { success: false, error: errorData.error || 'An unknown error occurred.' };
  };

  const login = async (body: any) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        return handleAuthSuccess(data);
      }
      return handleAuthError(res);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  const signOut = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setProfile(null);
    navigate('/login');
  };

  const value = {
    profile,
    loading,
    token,
    login,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};