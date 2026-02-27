import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@supabase/supabase-js";

const EDGE_FUNCTION_URL =
  "https://jjtvugsixtauuwyyzkoc.supabase.co/functions/v1/imacx-login";

// ✅ Initialize Supabase client
const supabase = createClient(
  "https://jjtvugsixtauuwyyzkoc.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqdHZ1Z3NpeHRhdXV3eXl6a29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMzMxMTIsImV4cCI6MjA3NDYwOTExMn0.NbIzQIouOFTQfbvZVHI4TnHtBT08uct2nuMMwx6HhHc",
);

/* =========================================================
   ✅ URL-SAFE BASE64 HELPERS (Fixes mobile '=' issue)
========================================================= */

// Encode safely for URLs
const encodeBase64Url = (value: string) => {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// Decode safely even if padding is missing or string has newlines/spaces
const decodeBase64Url = (value: string) => {
  // 1. Replace spaces with '+' (in case URL parser converted '+' to ' ')
  // 2. Replace URL-safe base64 '-' and '_' with standard '+' and '/'
  let base64 = value.replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/");

  // 3. Strip all characters that aren't valid base64 data (like whitespace, metadata, or existing '=' padding)
  base64 = base64.replace(/[^A-Za-z0-9+/]/g, "");

  // 4. Properly re-pad the string
  while (base64.length % 4) {
    base64 += "=";
  }

  return atob(base64);
};

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imacxId, setImacxId] = useState("");

  /* =========================================================
     ✅ Auto-redirect if already logged in
  ========================================================= */
  useEffect(() => {
    const user = localStorage.getItem("vitaminDUser");
    if (user) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  /* =========================================================
     ✅ Authentication Handler
  ========================================================= */
  const handleIMACXLogin = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // 🔹 Check BE users
        const { data: beUser, error: beError } = await supabase
          .from("users")
          .select("*")
          .eq("imacx_id", id)
          .maybeSingle();

        if (beError) throw new Error("Database error (BE): " + beError.message);

        if (beUser) {
          // 🔹 Call Edge Function (with timeout)
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(EDGE_FUNCTION_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imacx_id: id }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new Error("Edge authentication failed");
            }

            const result = await response.json();

            const userData = {
              id: result.session?.user?.id || beUser.id,
              email: result.session?.user?.email || `${id}@company.com`,
              imacx_id: id,
              role: "BE",
              territory: beUser.territory,
              name: beUser.name,
              phone: beUser.phone,
              loginTime: new Date().toISOString(),
            };

            localStorage.setItem("vitaminDUser", JSON.stringify(userData));

            navigate("/", { replace: true });
          } catch {
            // 🔹 Fallback login if edge fails
            const userData = {
              id: beUser.id,
              email: beUser.email || `${id}@company.com`,
              imacx_id: id,
              role: "BE",
              territory: beUser.territory,
              name: beUser.name,
              phone: beUser.phone,
              loginTime: new Date().toISOString(),
            };

            localStorage.setItem("vitaminDUser", JSON.stringify(userData));

            navigate("/", { replace: true });
          }

          return;
        }

        // 🔹 Check BM users
        const { data: bmUsers, error: bmError } = await supabase
          .from("usersbm")
          .select("*")
          .eq("imacx_id", id)
          .order("id", { ascending: true });

        if (bmError) throw new Error("Database error (BM): " + bmError.message);

        if (!bmUsers || bmUsers.length === 0) {
          throw new Error("Invalid IMACX ID");
        }

        const bmUser = bmUsers[0];

        const allBeTerritories = bmUsers
          .map((row) => row.beterritory)
          .filter((t) => t && t.trim().length > 0)
          .join(",");

        const userData = {
          id: bmUser.id,
          email: bmUser.email || `${id}@company.com`,
          imacx_id: id,
          role: "BM",
          territory: bmUser.territory,
          beterritory: allBeTerritories,
          name: bmUser.name,
          phone: bmUser.phone,
          loginTime: new Date().toISOString(),
        };

        localStorage.setItem("vitaminDUser", JSON.stringify(userData));

        navigate("/", { replace: true });
      } catch (err: any) {
        const message =
          err.name === "AbortError"
            ? "Request timeout. Please try again."
            : err.message || "Authentication failed";

        setError(message);

        toast({
          title: "Authentication Failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, toast],
  );

  /* =========================================================
     ✅ Decode URL Parameter Safely
  ========================================================= */
  useEffect(() => {
    const encodedParam = searchParams.get("data");
    if (!encodedParam) return;

    try {
      const decodedId = decodeBase64Url(encodedParam).trim();
      if (!decodedId) throw new Error();
      handleIMACXLogin(decodedId);
    } catch {
      setError("Invalid or corrupted link. Please check your URL.");

      toast({
        title: "Invalid Link",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  }, [searchParams, handleIMACXLogin, toast]);

  /* =========================================================
     ✅ Manual Login
  ========================================================= */
  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!imacxId.trim()) {
      toast({
        title: "Missing IMACX ID",
        description: "Please enter your IMACX ID.",
        variant: "destructive",
      });
      return;
    }

    const encoded = encodeBase64Url(imacxId.trim());
    navigate(`/auth?data=${encoded}`, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background px-4">
      <div className="bg-card shadow-lg rounded-xl p-8 w-full max-w-md text-center space-y-6">
        <h1 className="text-2xl font-bold">Vitamin D Camp Login</h1>

        {isLoading ? (
          <div className="space-y-3">
            <Activity className="h-8 w-8 animate-spin mx-auto" />
            <p>Authenticating...</p>
          </div>
        ) : (
          <>
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div className="text-left space-y-2">
                <Label htmlFor="imacx">IMACX ID</Label>
                <Input
                  id="imacx"
                  type="text"
                  placeholder="Enter your IMACX ID"
                  value={imacxId}
                  onChange={(e) => setImacxId(e.target.value)}
                  required
                />
              </div>
            </form>

            {error && <p className="text-destructive text-sm mt-3">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default Auth;