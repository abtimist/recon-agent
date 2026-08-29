import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

export interface AuthStatus {
  clerk_user_id: string;
  org_id: string | null;
  org_role: string | null;
  plan: string;
  is_pat: boolean;
  scopes: string[];
}

export function useAuthStatus() {
  const { getToken } = useAuth();
  const [data, setData] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function fetchStatus() {
      try {
        const token = await getToken();
        if (!token) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/auth/status`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error("Failed to fetch auth status");
        const json = await res.json();
        if (mounted) {
          setData(json);
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err);
          setLoading(false);
        }
      }
    }
    
    fetchStatus();
    
    return () => {
      mounted = false;
    };
  }, [getToken]);

  return { data, loading, error };
}
