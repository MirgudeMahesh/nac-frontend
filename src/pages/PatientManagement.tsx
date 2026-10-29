import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { ArrowLeft, Plus, Users, Calculator, FileText } from "lucide-react";
import {
  fetchCampPatients,
  sendWhatsAppMessage,
} from "@/utils/campUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

/* ------------------------------------------------------------------ */
/*  Neuropathy Symptom Score (NSS) – questions + scoring               */
/* ------------------------------------------------------------------ */

const NSS_MAX_SCORE = 10;
const NEUROPATHIC_CUTOFF = 3; // score >= 3 => Neuropathic

// Group 1 – Symptomatology (Foot / Lower Leg)
const SYMPTOM_QUESTIONS: { key: string; label: string; points: number }[] = [
  { key: "burning", label: "Burning", points: 2 },
  { key: "numbness", label: "Numbness", points: 2 },
  { key: "paraesthesia", label: "Paraesthesia", points: 2 },
  { key: "weakness", label: "Feeling of weakness (fatigue, exhaustion)", points: 1 },
  { key: "cramps", label: "Cramps", points: 1 },
  { key: "pain", label: "Pain", points: 1 },
];

// Group 2 – Localization
const LOCATION_OPTIONS = [
  { value: "feet", label: "Feet", points: 2 },
  { value: "lower_leg", label: "Lower leg", points: 1 },
  { value: "elsewhere", label: "Elsewhere", points: 0 },
];

// Group 3 – Exacerbation
const TIMING_OPTIONS = [
  { value: "night", label: "Present at night", points: 2 },
  { value: "day_night", label: "Present during day and night", points: 1 },
  { value: "day_only", label: "Only present during the day", points: 0 },
];

// Group 4 – Symptom improvement when
const IMPROVE_OPTIONS = [
  { value: "walking", label: "Walking", points: 2 },
  { value: "standing", label: "Standing", points: 1 },
  { value: "resting", label: "Sitting or lying down", points: 0 },
];

const HIGH_SYMPTOMS = ["burning", "numbness", "paraesthesia"]; // 2 points
const LOW_SYMPTOMS = ["weakness", "cramps", "pain"]; // 1 point

type FormState = {
  patient_name: string;
  age: string;
  hba1c: string;
  burning: string;
  numbness: string;
  paraesthesia: string;
  weakness: string;
  cramps: string;
  pain: string;
  location: string;
  timing: string;
  wakes_from_sleep: string;
  improvement: string;
  [key: string]: string;
};

const EMPTY_FORM: FormState = {
  patient_name: "",
  age: "",
  hba1c: "",
  burning: "",
  numbness: "",
  paraesthesia: "",
  weakness: "",
  cramps: "",
  pain: "",
  location: "",
  timing: "",
  wakes_from_sleep: "",
  improvement: "",
};

const hasAnySymptom = (f: Record<string, any>) =>
  [...HIGH_SYMPTOMS, ...LOW_SYMPTOMS].some((k) => f[k] === "yes");

const calculateNssScore = (f: Record<string, any>): number => {
  // Group 1: highest symptom type present
  let group1 = 0;
  if (HIGH_SYMPTOMS.some((k) => f[k] === "yes")) group1 = 2;
  else if (LOW_SYMPTOMS.some((k) => f[k] === "yes")) group1 = 1;

  // No symptoms at all => score 0
  if (group1 === 0) return 0;

  const location = f.location === "feet" ? 2 : f.location === "lower_leg" ? 1 : 0;
  const timing = f.timing === "night" ? 2 : f.timing === "day_night" ? 1 : 0;
  const wakes = f.wakes_from_sleep === "yes" ? 1 : 0;
  const improvement = f.improvement === "walking" ? 2 : f.improvement === "standing" ? 1 : 0;

  return group1 + location + timing + wakes + improvement;
};

const getNssInterpretation = (score: number): "Neuropathic" | "Non-Neuropathic" =>
  score >= NEUROPATHIC_CUTOFF ? "Neuropathic" : "Non-Neuropathic";

const getBadgeVariant = (interpretation: string | null) =>
  interpretation === "Neuropathic" ? "destructive" : "default";

/* ------------------------------------------------------------------ */
/*  Sheet-style checkbox components                                    */
/* ------------------------------------------------------------------ */

const GROUP_GRID =
  "grid grid-cols-[1fr_52px_52px_36px] sm:grid-cols-[1fr_80px_80px_60px] items-center gap-2";
const CHOICE_GRID =
  "grid grid-cols-[1fr_72px_36px] sm:grid-cols-[1fr_110px_60px] items-center gap-2";

// Wrapper with a numbered, shaded header (like the groups on the sheet)
const GroupBox = ({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="border rounded-lg overflow-hidden bg-card">
    <div className="flex items-center gap-3 bg-muted px-3 py-2 border-b">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
        {number}
      </span>
      <span className="text-sm font-bold uppercase tracking-wide text-foreground">
        {title}
      </span>
    </div>
    {children}
  </div>
);

// Header row for Yes / No groups
const YesNoHeader = () => (
  <div className={`${GROUP_GRID} px-3 py-1.5 border-b bg-muted/40 text-xs font-semibold text-muted-foreground`}>
    <div>Symptom</div>
    <div className="text-center">Yes</div>
    <div className="text-center">No</div>
    <div className="text-center">Pts</div>
  </div>
);

// Row with Yes + No checkboxes (mutually exclusive)
const YesNoRow = ({
  no,
  label,
  points,
  value,
  onChange,
}: {
  no: number;
  label: string;
  points: number;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className={`${GROUP_GRID} px-3 py-2 border-b last:border-b-0`}>
    <div className="text-sm text-foreground">
      <span className="text-muted-foreground mr-2">{no}.</span>
      {label}
    </div>
    <label className="flex items-center justify-center gap-1 cursor-pointer">
      <Checkbox
        checked={value === "yes"}
        onCheckedChange={(c) => onChange(c ? "yes" : "")}
      />
      <span className="text-xs text-muted-foreground">{points}</span>
    </label>
    <label className="flex items-center justify-center gap-1 cursor-pointer">
      <Checkbox
        checked={value === "no"}
        onCheckedChange={(c) => onChange(c ? "no" : "")}
      />
      <span className="text-xs text-muted-foreground">0</span>
    </label>
    <div className="text-center text-sm font-bold text-foreground">{points}</div>
  </div>
);

// Header row for "select one" groups
const ChoiceHeader = () => (
  <div className={`${CHOICE_GRID} px-3 py-1.5 border-b bg-muted/40 text-xs font-semibold text-muted-foreground`}>
    <div>Select one</div>
    <div className="text-center">Yes</div>
    <div className="text-center">Pts</div>
  </div>
);

// Row with a single checkbox (only one row per group can be ticked)
const ChoiceRow = ({
  no,
  label,
  points,
  checked,
  onToggle,
}: {
  no: number;
  label: string;
  points: number;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) => (
  <div className={`${CHOICE_GRID} px-3 py-2 border-b last:border-b-0`}>
    <div className="text-sm text-foreground">
      <span className="text-muted-foreground mr-2">{no}.</span>
      {label}
    </div>
    <label className="flex items-center justify-center gap-1 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(c) => onToggle(c === true)} />
      <span className="text-xs text-muted-foreground">{points}</span>
    </label>
    <div className="text-center text-sm font-bold text-foreground">{points}</div>
  </div>
);

/* ------------------------------------------------------------------ */

interface Patient {
  id: string;
  patient_number: number;
  patient_name?: string | null;
  initials?: string | null; // old column, used as fallback for the name
  age: number;
  hba1c: number | null;
  total_score: number;
  risk_level: string | null; // "Neuropathic" | "Non-Neuropathic"
  questionnaire_responses: Record<string, string> | string | null;
}

const PatientManagement = () => {
  const { campId } = useParams<{ campId: string }>();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  const [showSummary, setShowSummary] = useState(false);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [summaryForm, setSummaryForm] = useState({
    total_patients: 0,
    adequate_patients: 0, // = Non-Neuropathic (column name kept for backend compatibility)
    inadequate_patients: 0, // = Neuropathic (column name kept for backend compatibility)
    rx_generated: "",
    units_sold: "",
    deksel_nano_syrup: "",
    deksel_2k_syrup: "",
    deksel_neo_syrup: "",
    deksel_cd: "",
    deksel_nd: "",
  });

  const [territoryPrefix, setTerritoryPrefix] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();

  const setField = (key: string, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const getPatientName = (p: Patient) => p.patient_name || p.initials || "";

  const fetchPatients = useCallback(async () => {
    if (!campId) return;

    try {
      const data = await fetchCampPatients(campId);
      setPatients(data as unknown as Patient[]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch patients";
      toast({
        title: "Error fetching patients",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [campId, toast]);

  useEffect(() => {
    const stored = localStorage.getItem("vitaminDUser");
    const currentUser = stored ? JSON.parse(stored) : null;
    const prefix = currentUser?.territory?.slice(0, 3) ?? "";
    setTerritoryPrefix(prefix);

    if (campId) {
      fetchPatients();
    }
  }, [campId, fetchPatients]);

  const handleAddPatient = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // ---- validation ----
      const symptomKeys = [...HIGH_SYMPTOMS, ...LOW_SYMPTOMS];
      const requiredFields = ["patient_name", "age", "hba1c", ...symptomKeys];
      if (hasAnySymptom(formData)) {
        requiredFields.push("location", "timing", "wakes_from_sleep", "improvement");
      }

      for (const field of requiredFields) {
        if (!formData[field] || !String(formData[field]).trim()) {
          toast({
            title: "Incomplete form",
            description: "Please answer all questions before generating the score.",
            variant: "destructive",
          });
          return;
        }
      }

      const age = Number(formData.age);
      if (!age || age < 1 || age > 120) {
        toast({
          title: "Invalid age",
          description: "Please enter a valid age.",
          variant: "destructive",
        });
        return;
      }

      const hba1c = Number(formData.hba1c);
      if (!hba1c || hba1c < 3 || hba1c > 20) {
        toast({
          title: "Invalid HbA1c",
          description: "Please enter a valid HbA1c value (3 – 20 %).",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      try {
        const nextPatientNumber = patients.length + 1;

        const totalScore = calculateNssScore(formData);
        const interpretation = getNssInterpretation(totalScore);
        const symptomsPresent = hasAnySymptom(formData);

        const questionnaireResponses = {
          burning: formData.burning,
          numbness: formData.numbness,
          paraesthesia: formData.paraesthesia,
          weakness: formData.weakness,
          cramps: formData.cramps,
          pain: formData.pain,
          location: symptomsPresent ? formData.location : "",
          timing: symptomsPresent ? formData.timing : "",
          wakes_from_sleep: symptomsPresent ? formData.wakes_from_sleep : "",
          improvement: symptomsPresent ? formData.improvement : "",
        };

        let data, error;

        const patientName = formData.patient_name.trim();

        const patientData = {
          patient_name: patientName,
          initials: patientName, // kept so the existing backend column still gets the name
          age,
          hba1c,
          total_score: totalScore,
          risk_level: interpretation,
          questionnaire_responses: questionnaireResponses,
        };

        if (editMode && editingPatientId) {
          try {
            data = await api.updatePatient(editingPatientId, patientData);
            error = null;
          } catch (err: any) { error = err; }
        } else {
          try {
            data = await api.createPatient({
              ...patientData,
              camp_id: campId,
              patient_number: nextPatientNumber,
            });
            error = null;
          } catch (err: any) { error = err; }
        }

        if (error) throw error;

        if (!editMode) {
          try {
            await api.updateCamp(campId, { total_patients: nextPatientNumber });
          } catch (updateError) { throw updateError; }
        }

        let campData = null;
        let campFetchError = null;
        try {
          campData = await api.getCampById(campId);
        } catch (err: any) { campFetchError = err; }

        if (!campFetchError && campData?.status === "scheduled") {
          await api.updateCamp(campId, { status: "active" });

          toast({
            title: "Camp Activated",
            description: "Camp status changed from scheduled to active.",
          });
        }

        toast({
          title: editMode ? "Patient updated successfully" : "Patient added successfully",
          description: editMode
            ? "Patient details have been updated."
            : `Patient ${nextPatientNumber} has been registered.`,
        });

        setFormData(EMPTY_FORM);
        setEditMode(false);
        setEditingPatientId(null);
        setShowAddForm(false);
        await fetchPatients();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to add patient";
        toast({
          title: "Error adding patient",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [formData, patients, campId, toast, fetchPatients, editMode, editingPatientId]
  );

  const handleCompleteCamp = useCallback(() => {
    const total = patients.length;
    const nonNeuropathic = patients.filter((p) => p.risk_level === "Non-Neuropathic").length;
    const neuropathic = patients.filter((p) => p.risk_level === "Neuropathic").length;

    setSummaryForm({
      total_patients: total,
      adequate_patients: nonNeuropathic,
      inadequate_patients: neuropathic,
      rx_generated: "",
      units_sold: "",
      deksel_nano_syrup: "",
      deksel_2k_syrup: "",
      deksel_neo_syrup: "",
      deksel_cd: "",
      deksel_nd: "",
    });

    setShowSummaryDialog(true);
    setShowSummary(true);
  }, [patients]);

  const handleDone = useCallback(
    async () => {
      // ---- VALIDATION START (commented out: sales fields are hidden for now) ----
      /*
      const isEmpty = (v: any) =>
        v === undefined || v === null || v === "";

      // For MAX: require units_sold (Deksel Nano 60K) and deksel_2k_syrup (Deksel 2K Spray)
      if (territoryPrefix === "MAX") {
        if (
          isEmpty(summaryForm.units_sold) ||
          isEmpty(summaryForm.deksel_2k_syrup)
        ) {
          toast({
            title: "Missing sales data",
            description:
              "Please fill Deksel Nano 60K and Deksel 2K Spray units sold before completing the camp.",
            variant: "destructive",
          });
          return;
        }
      }

      // For NUC: require deksel_nano_syrup (Deksel Neo 60K) and deksel_neo_syrup (Deksel 1K Spray)
      if (territoryPrefix === "NUC") {
        if (
          isEmpty(summaryForm.deksel_nano_syrup) ||
          isEmpty(summaryForm.deksel_neo_syrup)
        ) {
          toast({
            title: "Missing sales data",
            description:
              "Please fill Deksel Neo 60K and Deksel 1K Spray units sold before completing the camp.",
            variant: "destructive",
          });
          return;
        }
      }

      if (territoryPrefix === "IMP") {
        if (isEmpty(summaryForm.deksel_cd)) {
          toast({
            title: "Missing sales data",
            description: "Please fill Deksel CD units sold before completing the camp.",
            variant: "destructive",
          });
          return;
        }
      }

      if (territoryPrefix === "STI" || territoryPrefix === "GLS") {
        if (isEmpty(summaryForm.deksel_nd)) {
          toast({
            title: "Missing sales data",
            description: "Please fill Deksel ND units sold before completing the camp.",
            variant: "destructive",
          });
          return;
        }
      }
      */
      // ---- VALIDATION END ----

      try {
        try {
          await api.updateCamp(campId, {
            total_patients: summaryForm.total_patients,
            adequate_patients: summaryForm.adequate_patients,
            inadequate_patients: summaryForm.inadequate_patients,

            // Sales fields are hidden for now -> send 0 so the backend needs no change.
            // Original logic (restore when the fields are shown again):
            //   rx_generated: summaryForm.rx_generated === "" ? null : Number(summaryForm.rx_generated),
            //   ['Deksel Nano 60K_']: summaryForm.units_sold === "" ? null : Number(summaryForm.units_sold),
            //   ['Deksel Neo 60K_']: summaryForm.deksel_nano_syrup === "" ? null : Number(summaryForm.deksel_nano_syrup),
            //   deksel_2k_syrup: summaryForm.deksel_2k_syrup === "" ? null : Number(summaryForm.deksel_2k_syrup),
            //   ['Deksel 1K Spray_']: summaryForm.deksel_neo_syrup === "" ? null : Number(summaryForm.deksel_neo_syrup),
            //   ['Deksel CD']: summaryForm.deksel_cd === "" ? null : Number(summaryForm.deksel_cd),
            //   ['Deksel ND']: summaryForm.deksel_nd === "" ? null : Number(summaryForm.deksel_nd),
            rx_generated: 0,
            ['Deksel Nano 60K_']: 0,
            ['Deksel Neo 60K_']: 0,
            deksel_2k_syrup: 0,
            ['Deksel 1K Spray_']: 0,
            ['Deksel CD']: 0,
            ['Deksel ND']: 0,

            status: "completed",
          });
        } catch (updateError) { throw updateError; }

        let campData = null;
        try {
          campData = await api.getCampById(campId);
        } catch (campError) {
          throw new Error("Doctor details not found.");
        }

        if (!campData?.doctors)
          throw new Error("Doctor details not found.");

        const doctor = campData.doctors;
        const contactNumber = doctor.whatsapp_number || doctor.phone;
        const formattedPhone = contactNumber.startsWith("+")
          ? contactNumber
          : `+91${contactNumber}`;

        const message = `
Dear Dr. ${doctor.name},

Please find below the summary of today’s Neuropathy Screening Camp conducted at your clinic:

• Total patients screened: ${summaryForm.total_patients}
• Patients with Neuropathic symptoms: ${summaryForm.inadequate_patients}
• Patients with Non-Neuropathic symptoms: ${summaryForm.adequate_patients}

Thank you for your kind cooperation and for partnering with Pulse Pharmaceuticals in this important public health initiative.
Team Pulse Pharmaceuticals
`.trim();

        const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(
          message
        )}`;
        window.open(waUrl, "_blank");

        toast({
          title: "Camp Completed",
          description: "Summary saved, message sent to doctor.",
        });

        setShowSummaryDialog(false);
        navigate("/");
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to complete camp";
        toast({
          title: "Error completing camp",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
    [summaryForm, campId, toast, navigate, territoryPrefix]
  );

  const sendSummaryToDoctor = useCallback(
    async () => {
      if (!campId) return;

      try {
        let campData = null;
        try {
          campData = await api.getCampById(campId);
        } catch (campError) {
          throw new Error("Doctor details not found");
        }

        if (!campData?.doctors) {
          throw new Error("Doctor details not found");
        }

        const doctor = campData.doctors;
        const patientsData = (
          patients.length > 0 ? patients : await fetchCampPatients(campId)
        ) as unknown as Patient[];

        const total = patientsData.length;
        const nonNeuropathic = patientsData.filter((p) => p.risk_level === "Non-Neuropathic").length;
        const neuropathic = patientsData.filter((p) => p.risk_level === "Neuropathic").length;

        const message = `
Dear Dr. ${doctor.name},

Please find below the summary of today’s Neuropathy Screening Camp conducted at ${doctor.clinic_name || "your clinic"}${doctor.city ? `, ${doctor.city}` : ""}:

• Total patients screened: ${total}
• Patients with Neuropathic symptoms: ${neuropathic}
• Patients with Non-Neuropathic symptoms: ${nonNeuropathic}

Thank you for your kind cooperation and for partnering with Pulse Pharmaceuticals in this important public health initiative.
Team Pulse Pharmaceuticals
`.trim();

        const phone = doctor.whatsapp_number || doctor.phone;
        sendWhatsAppMessage(phone, message);

        toast({
          title: "Summary ready to send",
          description: `Opening WhatsApp to send summary to Dr. ${doctor.name}.`,
        });

        setTimeout(() => navigate(`/camp/${campId}`), 2000);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to send summary";
        toast({
          title: "Error sending summary",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
    [campId, patients, toast, navigate]
  );

  const printWithRawBT = useCallback((patient: Patient) => {
    const name = patient.patient_name || patient.initials || "N/A";
    const hba1c =
      patient.hba1c !== null && patient.hba1c !== undefined && !isNaN(Number(patient.hba1c))
        ? `${Number(patient.hba1c)} %`
        : "N/A";
    const score = patient.total_score ?? 0;
    const interpretation = patient.risk_level ?? "N/A";

    const printable = `
--------------------------
 Neuropathy Symptom Score
--------------------------
Patient: ${name}
Age: ${patient.age}
HbA1c: ${hba1c}

NSS Score: ${score}
Interpretation: ${interpretation}

--------------------------
GUIDE:
0 - 2  → Non-Neuropathic
3 & above → Neuropathic
--------------------------
This is a screening test 
and not a substitute for
a diagnostic test.Please 
consult your doctor for 
interpretation and 
appropriate treatment.  
`;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isAndroid) {
      window.location.href = "rawbt:" + encodeURIComponent(printable);
    } else if (isIOS) {
      const emLabelURL = "emlabel://print?text=" + encodeURIComponent(printable);
      window.location.href = emLabelURL;
    } else {
      alert("Printing is supported only on Android (RawBT) or iOS (EMLabel).");
    }
  }, []);

  const handleEditPatient = useCallback((patient: Patient) => {
    setShowAddForm(true);
    setEditMode(true);
    setEditingPatientId(patient.id);

    let responses: Record<string, string> = {};
    if (patient.questionnaire_responses) {
      if (typeof patient.questionnaire_responses === "object") {
        responses = patient.questionnaire_responses;
      } else {
        try {
          responses = JSON.parse(patient.questionnaire_responses);
        } catch {
          responses = {};
        }
      }
    }

    setFormData({
      ...EMPTY_FORM,
      patient_name: patient.patient_name || patient.initials || "",
      age: patient.age?.toString() || "",
      hba1c:
        patient.hba1c !== null && patient.hba1c !== undefined ? String(patient.hba1c) : "",
      ...responses,
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading patients...</p>
        </div>
      </div>
    );
  }

  const symptomsPresent = hasAnySymptom(formData);
  const liveScore = calculateNssScore(formData);
  const liveInterpretation = getNssInterpretation(liveScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background overflow-y-auto scroll-smooth">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(`/`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Patient Management</h1>
              <p className="text-muted-foreground mt-2">
                Total Patients: {patients.length}
              </p>
            </div>
            <Button
              onClick={() => {
                setFormData(EMPTY_FORM);
                setEditMode(false);
                setEditingPatientId(null);
                setShowAddForm(true);
              }}
              className="bg-gradient-to-r from-primary to-medical-teal hover:from-primary/90 hover:to-medical-teal/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Patient
            </Button>
          </div>
        </div>

        {showAddForm && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2 text-primary" />
                    {editMode ? "Edit Patient Details" : "Add New Patient"}
                  </CardTitle>

                  <CardDescription>
                    {editMode ? "Neuropathy Symptom Score (NSS)" : `Patient ${patients.length + 1} – Neuropathy Symptom Score (NSS)`}
                  </CardDescription>
                  {editMode && (
                    <p className="text-sm text-yellow-600 mt-2">
                      Editing existing patient record. Changes will overwrite saved data.
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddPatient} className="space-y-6">
                <Accordion type="single" collapsible defaultValue="sectionA">
                  {/* Section A – Patient details */}
                  <AccordionItem value="sectionA">
                    <AccordionTrigger>Section A – Patient Details</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="space-y-2">
                          <Label>Name of the Patient *</Label>
                          <Input
                            placeholder="Enter patient name"
                            value={formData.patient_name}
                            onChange={(e) => setField("patient_name", e.target.value)}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Age (years) *</Label>
                          <Input
                            type="number"
                            min="1"
                            max="120"
                            value={formData.age}
                            onChange={(e) => setField("age", e.target.value)}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>HbA1c (%) *</Label>
                          <Input
                            type="number"
                            min="3"
                            max="20"
                            step="0.1"
                            value={formData.hba1c}
                            onChange={(e) => setField("hba1c", e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Section B – NSS questions (sheet-style checkboxes) */}
                  <AccordionItem value="sectionB">
                    <AccordionTrigger>Section B – Symptom Questions</AccordionTrigger>
                    <AccordionContent>
                      <div className="mt-4 space-y-4">
                        {/* 1. Symptomatology */}
                        <GroupBox number={1} title="Symptomatology: Foot / Lower Leg">
                          <YesNoHeader />
                          {SYMPTOM_QUESTIONS.map((q, i) => (
                            <YesNoRow
                              key={q.key}
                              no={i + 1}
                              label={q.label}
                              points={q.points}
                              value={formData[q.key]}
                              onChange={(v) => setField(q.key, v)}
                            />
                          ))}
                          <p className="px-3 py-2 text-xs text-muted-foreground bg-muted/30">
                            Answer every symptom. Only the highest-scoring symptom present counts
                            (2 points if any of items 1–3 is Yes, otherwise 1 point if any of
                            items 4–6 is Yes).
                          </p>
                        </GroupBox>

                        {!symptomsPresent && (
                          <p className="text-xs text-muted-foreground px-1">
                            Tick Yes for at least one symptom to answer the remaining groups.
                            If all symptoms are No, the score is 0.
                          </p>
                        )}

                        {symptomsPresent && (
                          <>
                            {/* 2. Localization */}
                            <GroupBox number={2} title="Localization">
                              <ChoiceHeader />
                              {LOCATION_OPTIONS.map((o, i) => (
                                <ChoiceRow
                                  key={o.value}
                                  no={7 + i}
                                  label={o.label}
                                  points={o.points}
                                  checked={formData.location === o.value}
                                  onToggle={(c) => setField("location", c ? o.value : "")}
                                />
                              ))}
                            </GroupBox>

                            {/* 3. Exacerbation */}
                            <GroupBox number={3} title="Exacerbation">
                              <ChoiceHeader />
                              {TIMING_OPTIONS.map((o, i) => (
                                <ChoiceRow
                                  key={o.value}
                                  no={10 + i}
                                  label={o.label}
                                  points={o.points}
                                  checked={formData.timing === o.value}
                                  onToggle={(c) => setField("timing", c ? o.value : "")}
                                />
                              ))}
                              <YesNoHeader />
                              <YesNoRow
                                no={13}
                                label="Patient is awakened from sleep by the symptoms"
                                points={1}
                                value={formData.wakes_from_sleep}
                                onChange={(v) => setField("wakes_from_sleep", v)}
                              />
                            </GroupBox>

                            {/* 4. Symptom improvement */}
                            <GroupBox number={4} title="Symptom Improvement When">
                              <ChoiceHeader />
                              {IMPROVE_OPTIONS.map((o, i) => (
                                <ChoiceRow
                                  key={o.value}
                                  no={14 + i}
                                  label={o.label}
                                  points={o.points}
                                  checked={formData.improvement === o.value}
                                  onToggle={(c) => setField("improvement", c ? o.value : "")}
                                />
                              ))}
                            </GroupBox>
                          </>
                        )}

                        {/* Live total, like the TOTAL NSS SCORE box on the sheet */}
                        <div className="flex items-center justify-between rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3">
                          <div>
                            <p className="text-sm font-bold uppercase tracking-wide text-foreground">
                              Total NSS Score
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Updates as you answer (0 – {NSS_MAX_SCORE})
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">{liveScore}</p>
                            <Badge variant={getBadgeVariant(liveInterpretation)}>
                              {liveInterpretation}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="flex justify-end space-x-4 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditMode(false);
                      setEditingPatientId(null);
                      setFormData(EMPTY_FORM);
                      setShowAddForm(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Calculator className="h-4 w-4 mr-2" />
                    {editMode ? "Save Changes" : "Calculate Score"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {patients.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No patients registered
              </h3>
              <p className="text-muted-foreground mb-4">
                Start by adding your first patient to the camp.
              </p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Patient
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((patient) => (
              <Card key={patient.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        Patient {patient.patient_number}
                      </CardTitle>
                      <CardDescription>{getPatientName(patient)}</CardDescription>
                    </div>
                    <Badge variant={getBadgeVariant(patient.risk_level)}>
                      {patient.risk_level}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Age:</span>
                      <span className="ml-2 font-medium">{patient.age}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">HbA1c:</span>
                      <span className="ml-2 font-medium">
                        {patient.hba1c !== null &&
                        patient.hba1c !== undefined &&
                        !isNaN(Number(patient.hba1c))
                          ? `${Number(patient.hba1c)} %`
                          : "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">NSS Score:</span>
                      <span className="ml-2 font-bold text-primary">
                        {patient.total_score} / {NSS_MAX_SCORE}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => printWithRawBT(patient)}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Generate Report
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => handleEditPatient(patient)}
                    >
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {patients.length > 0 && (
          <div className="mt-8 flex justify-center">
            <Button
              onClick={handleCompleteCamp}
              disabled={showSummary}
              className="bg-gradient-to-r from-green-600 to-green-400 hover:opacity-90"
            >
              Complete Camp
            </Button>
          </div>
        )}

        {showSummary && (
          <Card className="mt-8 border-primary/40">
            <CardHeader>
              <CardTitle>Camp Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Non-Neuropathic</p>
                  <p className="text-xl font-bold text-green-600">
                    {patients.filter((p) => p.risk_level === "Non-Neuropathic").length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Neuropathic</p>
                  <p className="text-xl font-bold text-red-600">
                    {patients.filter((p) => p.risk_level === "Neuropathic").length}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <Button
                  onClick={sendSummaryToDoctor}
                  className="bg-gradient-to-r from-primary to-medical-teal hover:opacity-90"
                >
                  Send Summary to Doctor
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/40">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">
              Camp Summary
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label>No. of Patients Screened</Label>
              <Input value={summaryForm.total_patients} readOnly />
            </div>

            <div>
              <Label>No. of Non-Neuropathic Patients</Label>
              <Input value={summaryForm.adequate_patients} readOnly />
            </div>

            <div>
              <Label>No. of Neuropathic Patients</Label>
              <Input value={summaryForm.inadequate_patients} readOnly />
            </div>

            {/* ---- Hidden for now: sales fields (backend receives 0) ----

            <div className="pt-3 border-t">
              <Label>No. of Rx Generated</Label>
              <Input
                type="number"
                value={summaryForm.rx_generated}
                onChange={(e) =>
                  setSummaryForm({ ...summaryForm, rx_generated: e.target.value })
                }
              />
            </div>

            {territoryPrefix === "MAX" && (
              <div>
                <Label>No. of Units Sold (Deksel Nano 60K)</Label>
                <Input
                  type="number"
                  value={summaryForm.units_sold}
                  onChange={(e) =>
                    setSummaryForm({ ...summaryForm, units_sold: e.target.value })
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {territoryPrefix === "NUC" && (
                <div>
                  <Label>No. of Units Sold (Deksel Neo 60K)</Label>
                  <Input
                    type="number"
                    value={summaryForm.deksel_nano_syrup}
                    onChange={(e) =>
                      setSummaryForm({
                        ...summaryForm,
                        deksel_nano_syrup: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {territoryPrefix === "MAX" && (
                <div>
                  <Label>No. of Units Sold (Deksel 2K Spray)</Label>
                  <Input
                    type="number"
                    value={summaryForm.deksel_2k_syrup}
                    onChange={(e) =>
                      setSummaryForm({
                        ...summaryForm,
                        deksel_2k_syrup: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {territoryPrefix === "NUC" && (
                <div>
                  <Label>No. of Units Sold (Deksel 1K Spray)</Label>
                  <Input
                    type="number"
                    value={summaryForm.deksel_neo_syrup}
                    onChange={(e) =>
                      setSummaryForm({
                        ...summaryForm,
                        deksel_neo_syrup: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {territoryPrefix === "IMP" && (
                <div>
                  <Label>No. of Units Sold (Deksel CD)</Label>
                  <Input
                    type="number"
                    value={summaryForm.deksel_cd}
                    onChange={(e) =>
                      setSummaryForm({
                        ...summaryForm,
                        deksel_cd: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {(territoryPrefix === "STI" || territoryPrefix === "GLS") && (
                <div>
                  <Label>No. of Units Sold (Deksel ND)</Label>
                  <Input
                    type="number"
                    value={summaryForm.deksel_nd}
                    onChange={(e) =>
                      setSummaryForm({
                        ...summaryForm,
                        deksel_nd: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </div>

            ---- end hidden sales fields ---- */}
          </div>

          <DialogFooter className="mt-6 flex justify-center">
            <Button
              onClick={handleDone}
              className="bg-green-600 hover:bg-green-700"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientManagement;