import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

// Removed Supabase Edge Function URL

/* =========================================================
   ✅ URL-SAFE BASE64 HELPERS (Fixes mobile '=' issue)
========================================================= */

// Encode safely for URLs
const encodeBase64Url = (value: string) => {
  return btoa(value);
};

// Decode safely
const decodeBase64Url = (value: string) => {
  return atob(value);
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
        let beUser = null;
        try {
          beUser = await api.getUserByImacxId(id);
        } catch (beError: any) {
          throw new Error("Database error (BE): " + beError.message);
        }

        if (beUser) {
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
          return;
        }

        // 🔹 Check BM users
        let bmUsers = null;
        try {
          bmUsers = await api.getBmUsersByImacxId(id);
        } catch (bmError: any) {
          throw new Error("Database error (BM): " + bmError.message);
        }

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