// ============================================================
// CAMPDETAILS.TSX - Production Ready
// ============================================================
import { useState, useEffect, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, MapPin, Phone, Users, FileText, AlertCircle } from "lucide-react";
import { fetchCampWithDoctor } from "@/utils/campUtils";

interface Doctor {
  name: string;
  specialty: string | null;
  clinic_name: string | null;
  clinic_address: string | null;
  city: string | null;
  phone: string;
  whatsapp_number: string | null;
}

interface Camp {
  id: string;
  camp_date: string;
  status: string;
  total_patients: number;
  adequate_patients?: number;   // = Non-Neuropathic patients
  inadequate_patients?: number; // = Neuropathic patients
  doctor: Doctor;
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

const CampDetails = () => {
  const { campId } = useParams<{ campId: string }>();
  const [camp, setCamp] = useState<Camp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchCampDetails = useCallback(async () => {
    if (!campId) {
      setError("Invalid camp ID");
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await fetchCampWithDoctor(campId);
      setCamp(data as Camp);
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to fetch camp details";
      setError(errorMessage);
      toast({
        title: "Error fetching camp details",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [campId, toast]);

  useEffect(() => {
    fetchCampDetails();
  }, [fetchCampDetails]);

  const handleBackToDashboard = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading camp details...</p>
        </div>
      </div>
    );
  }

  if (error || !camp) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Camp Not Found
              </h2>
              <p className="text-sm text-muted-foreground">
                {error || "The camp you're looking for doesn't exist."}
              </p>
            </div>
            <Button onClick={handleBackToDashboard}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusVariant = (
    status: string
  ): "default" | "destructive" | "secondary" | "outline" => {
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={handleBackToDashboard}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Camp Details</h1>
            <p className="text-muted-foreground mt-2">
              {camp.doctor.name} •{" "}
              {new Date(camp.camp_date).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <Badge variant={getStatusVariant(camp.status)} className="text-sm capitalize">
            {camp.status}
          </Badge>
        </div>

        {/* Top Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-primary" />
                <div className="ml-4">
                  <div className="text-sm text-muted-foreground">Camp Date</div>
                  <div className="text-xl font-bold text-foreground">
                    {new Date(camp.camp_date).toLocaleDateString("en-IN")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-medical-teal" />
                <div className="ml-4">
                  <div className="text-sm text-muted-foreground">Total Patients</div>
                  <div className="text-xl font-bold text-foreground">
                    {camp.total_patients || 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="text-xl font-bold text-foreground capitalize">
                    {camp.status}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Screening Distribution */}
        {camp.status === "completed" &&
          (camp.adequate_patients !== undefined ||
            camp.inadequate_patients !== undefined) && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Screening Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <RiskDistribution
                  adequate={camp.adequate_patients || 0}
                  inadequate={camp.inadequate_patients || 0}
                />
              </CardContent>
            </Card>
          )}

        {/* Doctor and Contact Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-primary" /> Doctor
                Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Name:</span>
                <span className="text-sm font-medium">{camp.doctor.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Specialty:</span>
                <span className="text-sm font-medium">
                  {camp.doctor.specialty || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Clinic:</span>
                <span className="text-sm font-medium">
                  {camp.doctor.clinic_name || "N/A"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Address:</span>
                <span className="text-sm font-medium">
                  {camp.doctor.clinic_address
                    ? `${camp.doctor.clinic_address}, ${camp.doctor.city}`
                    : camp.doctor.city || "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="h-5 w-5 mr-2 text-primary" /> Contact
                Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Phone:</span>
                <a
                  href={`tel:${camp.doctor.phone}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {camp.doctor.phone}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">WhatsApp:</span>
                {camp.doctor.whatsapp_number ? (
                  <a
                    href={`https://wa.me/${camp.doctor.whatsapp_number.startsWith("+") ? camp.doctor.whatsapp_number.slice(1) : camp.doctor.whatsapp_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {camp.doctor.whatsapp_number}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">
                    Not Provided
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CampDetails;