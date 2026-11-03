import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Activity, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HiddenLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [imacxId, setImacxId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imacxId.trim()) {
      toast({
        title: "Missing IMACX ID",
        description: "Please enter your IMACX ID.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const encoded = btoa(imacxId.trim());
      // Navigate to auto-login route with token
      navigate(`/auth?data=${encoded}`, { replace: true });
    } catch (err: any) {
      setError("Failed to encode IMACX ID.");
      toast({
        title: "Error",
        description: "Failed to encode IMACX ID.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background px-4">
      <div className="bg-card shadow-lg rounded-xl p-8 w-full max-w-md text-center space-y-6">
        <h1 className="text-2xl font-bold text-foreground">
          Neuropathy Camp Login (Hidden)
        </h1>
        <p className="text-muted-foreground text-sm">
          Enter IMACX ID to generate an auto-login link.
        </p>

        {isLoading ? (
          <div className="space-y-3">
            <Activity className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Preparing...</p>
          </div>
        ) : (
          <>
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div className="text-left space-y-2">
                <Label htmlFor="imacx">IMACX ID</Label>
                <Input
                  id="imacx"
                  type="text"
                  placeholder="Enter IMACX ID"
                  value={imacxId}
                  onChange={(e) => setImacxId(e.target.value)}
                  required
                />
              </div>

              {/* <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={isLoading}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Login via Auto-Link
              </Button> */}
            </form>

            {error && (
              <p className="text-destructive text-sm mt-3">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HiddenLogin;
