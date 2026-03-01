import { createContext, useContext, ReactNode } from "react";

interface AuthContextType {
  user: { id: string; email: string };
  session: { user: { id: string; email: string } };
  loading: false;
  isAdmin: true;
  signOut: () => Promise<void>;
}

const mockUser = { id: "local-dev-user", email: "demo@alienbuster.local" };

const AuthContext = createContext<AuthContextType>({
  user: mockUser,
  session: { user: mockUser },
  loading: false,
  isAdmin: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: mockUser,
        session: { user: mockUser },
        loading: false,
        isAdmin: true,
        signOut: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
