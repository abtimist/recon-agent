import { useAuth } from "@clerk/nextjs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * A custom hook to interact with the FastAPI backend.
 * Automatically attaches the Clerk JWT to every request.
 */
export function useApi() {
  const { getToken } = useAuth();

  const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    const headers = new Headers(options.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      cache: "no-store",
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API error: ${response.status}`);
    }

    // Some endpoints (like DELETE) return 204 No Content
    if (response.status === 204) return null;

    // Handle streaming endpoints (CSV, Excel, PDF)
    const contentType = response.headers.get("content-type") || "";
    if (
      contentType.includes("text/csv") ||
      contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ||
      contentType.includes("application/pdf")
    ) {
      return response.blob();
    }

    return response.json();
  };

  return { fetchWithAuth };
}
