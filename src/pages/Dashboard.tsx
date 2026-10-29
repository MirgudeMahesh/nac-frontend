// ============================================================
// DASHBOARD.TSX - Production Ready (User-Specific Camps Only)
// ============================================================
import { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import CreateCampInline from "./CreateCampInline";
import {
  Plus,
  Calendar,
  LogOut,
  Stethoscope,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// Types
interface User {
  id: string;
  email: string;
  imacx_id: string;
  loginTime: string;
}

interface Camp {
  id: string;
  camp_date: string;
  status: string;
  total_patients: number;
  adequate_patients?: number;   // = Non-Neuropathic patients
  inadequate_patients?: number; // = Neuropathic patients
  doctor: {
    name: string;
    clinic_name: string;
    city: string;
  };
}

interface DashboardStats {
  totalCamps: number;
  activeCamps: number;
  completedCamps: number;
  upcomingCamps: number;
}

// Risk Distribution Component
const RiskDistribution = memo(
  ({
    adequate,
    inadequate,
  }: {
    adequate: number;   // = Non-Neuropathic patients
    inadequate: number; // = Neuropathic patients
  }) => {
    const total = adequate + inadequate || 1;
    const adequatePct = Math.round((adequate / total) * 100);
    const inadequatePct = Math.round((inadequate / total) * 100);

    return (
      <div className="mt-3">
        <p className="text-sm font-medium text-foreground mb-1">
          Neuropathy Screening Summary
        </p>
        <div className="w-full h-2 rounded-full overflow-hidden bg-muted/50 flex">
          <div
            className="bg-green-500 h-full transition-all duration-300"
            style={{ width: `${adequatePct}%` }}
            role="progressbar"
            aria-valuenow={adequatePct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Non-Neuropathic patients percentage"
          />
          <div
            className="bg-red-500 h-full transition-all duration-300"
            style={{ width: `${inadequatePct}%` }}
            role="progressbar"
            aria-valuenow={inadequatePct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Neuropathic patients percentage"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          🟢 Non-Neuropathic: {adequate} &nbsp; | &nbsp; 🔴 Neuropathic: {inadequate}
        </p>
      </div>
    );
  }
);
RiskDistribution.displayName = "RiskDistribution";

// Stat Card Component
const StatCard = memo(
  ({
    icon,
    label,
    value,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number;
  }) => (
    <Card className="bg-gradient-to-br from-card to-background border-primary/20 hover:shadow-md transition-shadow">
      <CardContent className="p-6 flex items-center">
        <div className="flex-shrink-0">{icon}</div>
        <div className="ml-4">
          <div className="text-sm font-medium text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-bold text-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
);
StatCard.displayName = "StatCard";

// Empty State Component
const EmptyState = memo(({ onCreate }: { onCreate: () => void }) => (
  <Card className="col-span-full text-center p-10 bg-muted/30">
    <Stethoscope className="h-12 w-12 text-primary mx-auto mb-4" />
    <h3 className="text-xl font-semibold text-foreground mb-2">
      Start Your First Neuropathy Camp
    </h3>
    <p className="text-muted-foreground mb-4">
      No active camps yet. Create one now to begin patient screening!
    </p>
    <Button
      onClick={onCreate}
      className="bg-gradient-to-r from-primary to-medical-teal hover:opacity-90"
    >
      <Plus className="h-4 w-4 mr-2" /> Create Camp
    </Button>
  </Card>
));
EmptyState.displayName = "EmptyState";

// ✅ Helper function to get current user from localStorage
const getCurrentUser = (): User | null => {
  try {
    const storedUser = localStorage.getItem("vitaminDUser");
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (err) {
    console.error("Error parsing user from localStorage:", err);
    return null;
  }
};

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCamps: 0,
    activeCamps: 0,
    completedCamps: 0,
    upcomingCamps: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showCreateCampModal, setShowCreateCampModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // ✅ Initialize user from localStorage on mount
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      toast({
        title: "Session Expired",
        description: "Please log in again.",
        variant: "destructive",
      });
      navigate("/auth", { replace: true });
      return;
    }
    setUser(currentUser);
  }, [navigate, toast]);

  // ✅ Fetch ONLY camps created by the current user
  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // 🔑 KEY CHANGE: Filter by user_id
      let data = null;
      try {
        data = await api.getCampsByUser(user.id);
      } catch (fetchError) {
        throw fetchError;
      }

      const formattedCamps: Camp[] =
        data?.map((camp: any) => ({
          id: camp.id,
          camp_date: camp.camp_date,
          status: camp.status,
          total_patients: camp.total_patients || 0,
          adequate_patients: camp.adequate_patients || 0,
          inadequate_patients: camp.inadequate_patients || 0,
          doctor: camp.doctor,
        })) || [];

      // ✅ Auto-activate camps scheduled for today
      const today = new Date().setHours(0, 0, 0, 0);
      for (const camp of formattedCamps) {
        const campDate = new Date(camp.camp_date).setHours(0, 0, 0, 0);
        if (camp.status === "scheduled" && campDate <= today) {
          await api.updateCamp(camp.id, { status: "active" });

          camp.status = "active";
        }
      }

      setCamps(formattedCamps);

      setStats({
        totalCamps: formattedCamps.length,
        activeCamps: formattedCamps.filter((c) => c.status === "active")
          .length,
        completedCamps: formattedCamps.filter((c) => c.status === "completed")
          .length,
        upcomingCamps: formattedCamps.filter((c) => c.status === "scheduled")
          .length,
      });
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to fetch dashboard data";
      setError(errorMessage);
      toast({
        title: "Error fetching dashboard data",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // ✅ Call fetchDashboardData when user is set
  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);
  // ✅ Updated handleSignOut

  const getStatusBadgeVariant = useCallback(
    (status: string): "default" | "destructive" | "secondary" | "outline" => {
      switch (status) {
        case "active":
          return "default";
        case "completed":
          return "secondary";
        case "cancelled":
          return "destructive";
        default:
          return "outline";
      }
    },
    []
  );

  const handleCreateCampSuccess = useCallback(
    (campId: string) => {
      setShowCreateCampModal(false);
      fetchDashboardData(); // Refresh dashboard
      navigate(`/camp/${campId}/patients`);
    },
    [navigate, fetchDashboardData]
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && camps.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Error Loading Dashboard</h3>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
            </div>
            <Button onClick={fetchDashboardData} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <Stethoscope className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Neuropathy Camp Dashboard
                </h1>
                <p className="text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>

          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Calendar className="h-8 w-8 text-medical-blue" />}
            label="Total Camps"
            value={stats.totalCamps}
          />
          <StatCard
            icon={<Activity className="h-8 w-8 text-medical-teal" />}
            label="Active Camps"
            value={stats.activeCamps}
          />
          <StatCard
            icon={<Clock className="h-8 w-8 text-medical-success" />}
            label="Upcoming Camps"
            value={stats.upcomingCamps}
          />
          <StatCard
            icon={<CheckCircle2 className="h-8 w-8 text-medical-warning" />}
            label="Completed Camps"
            value={stats.completedCamps}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-foreground">My Camps</h2>
          <Button
            onClick={() => setShowCreateCampModal(true)}
            className="bg-gradient-to-r from-primary to-medical-teal hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-2" /> Create New Camp
          </Button>
        </div>

        {/* Create Camp Modal */}
        <Dialog
          open={showCreateCampModal}
          onOpenChange={setShowCreateCampModal}
        >
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/40">
            <DialogHeader>
              <DialogTitle>Create New Camp</DialogTitle>
            </DialogHeader>
            <CreateCampInline onSuccess={handleCreateCampSuccess} />
          </DialogContent>
        </Dialog>

        {/* Camps List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {camps.length === 0 ? (
            <EmptyState onCreate={() => setShowCreateCampModal(true)} />
          ) : (
            camps.map((camp) => (
              <Card
                key={camp.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {camp?.doctor?.name || "Unknown Doctor"}
                      </CardTitle>
                      <CardDescription>
                        {[camp?.doctor?.clinic_name, camp?.doctor?.city].filter(Boolean).join(", ") || "Unknown Location"}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusBadgeVariant(camp.status)}>
                      {camp.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Camp Date:</span>
                      <span className="font-medium">
                        {new Date(camp.camp_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Patients:</span>
                      <span className="font-medium">
                        {camp.total_patients || 0}
                      </span>
                    </div>

                    {camp.status === "completed" && (
                      <RiskDistribution
                        adequate={camp.adequate_patients || 0}
                        inadequate={camp.inadequate_patients || 0}
                      />
                    )}
                  </div>

                  <div className="mt-4 flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/camp/${camp.id}`)}
                      className="flex-1"
                    >
                      View Details
                    </Button>

                    {camp.status === "active" && (
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-primary to-medical-teal hover:opacity-90"
                        onClick={() => navigate(`/camp/${camp.id}/patients`)}
                      >
                        Manage Patients
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;