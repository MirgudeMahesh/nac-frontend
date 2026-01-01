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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Users, Calculator, FileText, Languages } from "lucide-react";
import { fetchCampPatients } from "@/utils/campUtils";
import {
  calculateBMI,
  getRiskLevel,
  getRiskBadgeVariant,
  validatePatientFormData,
  calculateSectionBScore,
  generateDoctorWhatsAppMessage,
  sendWhatsAppMessage,
  formatPhoneNumber,
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
import { formTranslations, type Language } from "@/utils/formTranslations";

interface Patient {
  id: string;
  patient_number: number;
  initials: string;
  age: number;
  gender: string;
  height_feet: number | null;
  height_inches: number | null;
  height_meters: number | null;
  weight_kg: number | null;
  bmi: number | null;
  diabetes: boolean;
  hypertension: boolean;
  hypothyroidism: boolean;
  hyperthyroidism: boolean;
  pcos: boolean;
  other_comorbidity: string | null;
  total_score: number;
  risk_level: string | null;
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
  const [language, setLanguage] = useState<Language>("english");
  const [formData, setFormData] = useState({
    initials: "",
    age: "",
    gender: "",
    height_feet: "",
    height_inches: "",
    weight_kg: "",
    diabetes: false,
    hypertension: false,
    hypothyroidism: false,
    hyperthyroidism: false,
    pcos: false,
    other_comorbidity: "",
    // Section B answers (18 questions)
    q3: "",
    q4: "",
    q5: "",
    q6: "",
    q7: "",
    q8: "",
    q9: "",
    q10: "",
    q11: "",
    q12: "",
    q13: "",
    q14: "",
    q15: "",
    q16: "",
    q17: "",
    q18: "",
  });

  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [summaryForm, setSummaryForm] = useState({
    total_patients: 0,
    adequate_patients: 0,
    inadequate_patients: 0,
    rx_generated: "",
    units_sold: "",
    deksel_nano_syrup: "",
    deksel_2k_syrup: "",
    deksel_neo_syrup: "",
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchPatients = useCallback(async () => {
    if (!campId) return;

    try {
      const data = await fetchCampPatients(campId);
      setPatients(data as Patient[]);
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


  const [territoryPrefix, setTerritoryPrefix] = useState("");

useEffect(() => {
  const stored = localStorage.getItem("vitaminDUser");
  console.log("Stored User:", stored);
  const currentUser = stored ? JSON.parse(stored) : null;
  const prefix = currentUser?.territory?.slice(0, 3) ?? "";
  setTerritoryPrefix(prefix);
  console.log("Territory Prefix:", prefix);

  if (campId) {
    fetchPatients();
  }
}, [campId, fetchPatients]);

  const handleAddPatient = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const requiredFields = [
        "initials",
        "age",
        "gender",
        "height_feet",
        "height_inches",
        "weight_kg",
        "q3",
        "q4",
        "q5",
        "q6",
        "q7",
        "q8",
        "q9",
        "q10",
        "q11",
        "q12",
        "q13",
        "q14",
        "q15",
        "q16",
        "q17",
        "q18",
      ];

      for (const field of requiredFields) {
        // @ts-expect-error index access
        if (!formData[field]) {
          toast({
            title: "Incomplete form",
            description: "Please answer all questions in Section A and B before generating report.",
            variant: "destructive",
          });
          return;
        }
      }

      if (!validatePatientFormData(formData)) {
        toast({
          title: "Missing required fields",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      try {
        const nextPatientNumber = patients.length + 1;

        const heightFeet = Number(formData.height_feet) || 0;
        const heightInches = Number(formData.height_inches) || 0;

        if (heightFeet > 7 || (heightFeet === 7 && heightInches > 0)) {
          toast({
            title: "Invalid height",
            description: "Height cannot exceed 7 feet.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const totalInches = heightFeet * 12 + heightInches;
        const heightMeters = totalInches > 0 ? totalInches * 0.0254 : 0;
        const weightKg = Number(formData.weight_kg) || 0;
        const age = Number(formData.age) || 0;

        const bmi = calculateBMI(weightKg, heightMeters);
        const totalScore = calculateSectionBScore(formData, age, bmi);
        const riskLevel = getRiskLevel(totalScore);

        const questionnaireResponses = {
          q1: age > 50 ? "yes" : "no",
          q2: bmi >= 30 ? "yes" : "no",
          q3: formData.q3,
          q4: formData.q4,
          q5: formData.q5,
          q6: formData.q6,
          q7: formData.q7,
          q8: formData.q8,
          q9: formData.q9,
          q10: formData.q10,
          q11: formData.q11,
          q12: formData.q12,
          q13: formData.q13,
          q14: formData.q14,
          q15: formData.q15,
          q16: formData.q16,
          q17: formData.q17,
          q18: formData.q18,
        };

        let data, error;

        if (editMode && editingPatientId) {
          ({ data, error } = await supabase
            .from("patients")
            .update({
              initials: formData.initials.trim(),
              age,
              gender: formData.gender,
              height_feet: heightFeet || null,
              height_inches: heightInches || null,
              height_meters: heightMeters || null,
              weight_kg: weightKg || null,
              bmi: bmi || null,
              diabetes: formData.diabetes,
              hypertension: formData.hypertension,
              hypothyroidism: formData.hypothyroidism,
              hyperthyroidism: formData.hyperthyroidism,
              pcos: formData.pcos,
              other_comorbidity: formData.other_comorbidity || null,
              total_score: totalScore,
              risk_level: riskLevel,
              questionnaire_responses: questionnaireResponses,
            })
            .eq("id", editingPatientId)
            .select()
            .single());
        } else {
          ({ data, error } = await supabase
            .from("patients")
            .insert({
              camp_id: campId,
              patient_number: nextPatientNumber,
              initials: formData.initials.trim(),
              age,
              gender: formData.gender,
              height_feet: heightFeet || null,
              height_inches: heightInches || null,
              height_meters: heightMeters || null,
              weight_kg: weightKg || null,
              bmi: bmi || null,
              diabetes: formData.diabetes,
              hypertension: formData.hypertension,
              hypothyroidism: formData.hypothyroidism,
              hyperthyroidism: formData.hyperthyroidism,
              other_comorbidity: formData.other_comorbidity || null,
              total_score: totalScore,
              risk_level: riskLevel,
              questionnaire_responses: questionnaireResponses,
            })
            .select()
            .single());
        }

        if (error) throw error;

        if (!editMode) {
          const { error: updateError } = await supabase
            .from("camps")
            .update({ total_patients: nextPatientNumber })
            .eq("id", campId);

          if (updateError) throw updateError;
        }

        const { data: campData, error: campFetchError } = await supabase
          .from("camps")
          .select("status")
          .eq("id", campId)
          .single();

        if (!campFetchError && campData?.status === "scheduled") {
          await supabase.from("camps").update({ status: "active" }).eq("id", campId);

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

        setFormData({
          initials: "",
          age: "",
          gender: "",
          height_feet: "",
          height_inches: "",
          weight_kg: "",
          diabetes: false,
          hypertension: false,
          hypothyroidism: false,
          hyperthyroidism: false,
          pcos: false,
          other_comorbidity: "",
          q3: "",
          q4: "",
          q5: "",
          q6: "",
          q7: "",
          q8: "",
          q9: "",
          q10: "",
          q11: "",
          q12: "",
          q13: "",
          q14: "",
          q15: "",
          q16: "",
          q17: "",
          q18: "",
        });

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
    const adequate = patients.filter((p) => p.risk_level === "Adequate").length;
    const inadequate = patients.filter((p) => p.risk_level === "Inadequate").length;

    setSummaryForm({
      total_patients: total,
      adequate_patients: adequate,
      inadequate_patients: inadequate,
      rx_generated: "",
      units_sold: "",
      deksel_nano_syrup: "",
      deksel_2k_syrup: "",
      deksel_neo_syrup: "",
    });

    setShowSummaryDialog(true);
    setShowSummary(true);
  }, [patients]);

  const handleDone = useCallback(
  async () => {
    // ---- VALIDATION START ----
    const isEmpty = (v: any) =>
      v === undefined || v === null || v === "" || Number(v) <= 0;

    // For MAX: require units_sold, deksel_2k_syrup, deksel_neo_syrup
    if (territoryPrefix === "MAX") {
      if (
        isEmpty(summaryForm.units_sold) ||
        isEmpty(summaryForm.deksel_2k_syrup) ||
        isEmpty(summaryForm.deksel_neo_syrup)
      ) {
        toast({
          title: "Missing sales data",
          description:
            "Please fill Deksel Nano 60K, Deksel 2K Spray and Deksel 1K Spray units sold before completing the camp.",
          variant: "destructive",
        });
        return;
      }
    }

    // For NUC: require deksel_nano_syrup and deksel_neo_syrup
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
    // ---- VALIDATION END ----

    try {
      const { error: updateError } = await supabase
        .from("camps")
        .update({
          total_patients: summaryForm.total_patients,
          adequate_patients: summaryForm.adequate_patients,
          inadequate_patients: summaryForm.inadequate_patients,
          rx_generated: Number(summaryForm.rx_generated) || null,
          units_sold: Number(summaryForm.units_sold) || null,
          deksel_nano_syrup: Number(summaryForm.deksel_nano_syrup) || null,
          deksel_2k_syrup: Number(summaryForm.deksel_2k_syrup) || null,
          deksel_neo_syrup: Number(summaryForm.deksel_neo_syrup) || null,
          status: "completed",
        })
        .eq("id", campId);

      if (updateError) throw updateError;

      const { data: campData, error: campError } = await supabase
        .from("camps")
        .select(`
          camp_date,
          doctors:doctor_id (
            name,
            phone,
            whatsapp_number,
            clinic_name,
            city
          )
        `)
        .eq("id", campId)
        .single();

      if (campError || !campData?.doctors)
        throw new Error("Doctor details not found.");

      const doctor = campData.doctors;
      const contactNumber = doctor.whatsapp_number || doctor.phone;
      const formattedPhone = contactNumber.startsWith("+")
        ? contactNumber
        : `+91${contactNumber}`;

      const message = `
Dear Dr. ${doctor.name},

Please find below the summary of today’s Vitamin D Screening Camp conducted at your clinic:

• Total patients screened: ${summaryForm.total_patients}
• Patients with Inadequate Vitamin D: ${summaryForm.inadequate_patients}
• Patients with Adequate Vitamin D: ${summaryForm.adequate_patients}

Thank you for your kind cooperation and for partnering with Pulse Pharmaceuticals in this important public health initiative.
Team Pulse Pharmaceuticals
Your Partner in managing Vitamin D Deficiency
`.trim();

      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(
        message
      )}`;
      window.open(waUrl, "_blank");

      toast({
        title: "Camp Completed",
        description: "Summary and sales data saved, message sent to doctor.",
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
        const { data: campData, error: campError } = await supabase
          .from("camps")
          .select(`
        camp_date,
        doctors:doctor_id (
          name,
          phone,
          whatsapp_number,
          clinic_name,
          city
        )
      `)
          .eq("id", campId)
          .single();

        if (campError || !campData?.doctors) {
          throw new Error("Doctor details not found");
        }

        const doctor = campData.doctors;
        const patientsData = patients.length > 0 ? patients : await fetchCampPatients(campId);

        const total = patientsData.length;
        const adequate = patientsData.filter((p) => p.risk_level === "Adequate").length;
        const inadequate = patientsData.filter((p) => p.risk_level === "Inadequate").length;

        const message = generateDoctorWhatsAppMessage(
          doctor.name,
          doctor.clinic_name,
          doctor.city,
          campData.camp_date,
          total,
          adequate,
          inadequate
        );

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
    console.log("Printing patient:", patient);
    const comorbidities: string[] = [];

    if (patient.diabetes) comorbidities.push("• Diabetes");
    if (patient.hypertension) comorbidities.push("• Hypertension");
    if (patient.hypothyroidism) comorbidities.push("• Hypothyroidism");
    if (patient.hyperthyroidism) comorbidities.push("• Hyperthyroidism");
    if (patient.pcos) comorbidities.push("• PCOS");
    if (patient.other_comorbidity) comorbidities.push(`• ${patient.other_comorbidity}`);

    const comorbidityText = comorbidities.length ? comorbidities.join("\n") : "• None";

    const feet = patient.height_feet ?? 0;
    const inches = patient.height_inches ?? 0;
    const weight = patient.weight_kg ?? 0;
    const bmi = patient.bmi ? patient.bmi.toFixed(1) : "N/A";
    const total = patient.total_score ?? 0;
    const risk = patient.risk_level ?? "N/A";

    const printable = `
--------------------------
 Vitamin D Assessment
--------------------------
Patient: ${patient.initials}
Age: ${patient.age}   Gender: ${patient.gender}
Height: ${feet}'${inches}"
Weight: ${weight}kg
BMI: ${bmi}

Comorbidities:
${comorbidityText}

Total Score: ${total}
Risk Level: ${risk}

--------------------------
ADEQUACY GUIDE:
< 5   → Adequate
≥ 5   → Inadequate
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

    setFormData({
      initials: patient.initials || "",
      age: patient.age?.toString() || "",
      gender: patient.gender || "",
      height_feet: patient.height_feet?.toString() || "",
      height_inches: patient.height_inches?.toString() || "",
      weight_kg: patient.weight_kg?.toString() || "",
      diabetes: patient.diabetes,
      hypertension: patient.hypertension,
      hypothyroidism: patient.hypothyroidism,
      hyperthyroidism: patient.hyperthyroidism,
      pcos: patient.pcos,
      other_comorbidity: patient.other_comorbidity || "",
      ...(typeof patient.questionnaire_responses === "object"
        ? patient.questionnaire_responses
        : {}),
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
              onClick={() => setShowAddForm(true)}
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
                    Patient {patients.length + 1}
                  </CardDescription>

                  {editMode && (
                    <p className="text-sm text-yellow-600 mt-2">
                      Editing existing patient record. Changes will overwrite saved data.
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Languages className="h-4 w-4 text-muted-foreground" />
                  <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="hindi">हिंदी</SelectItem>
                      <SelectItem value="telugu">తెలుగు</SelectItem>
                      <SelectItem value="tamil">தமிழ்</SelectItem>
                      <SelectItem value="bhojpuri">भोजपुरी</SelectItem>
                      <SelectItem value="bengali">বাংলা</SelectItem>
                      <SelectItem value="marathi">मराठी</SelectItem>
                      <SelectItem value="kannada">ಕನ್ನಡ</SelectItem>
                      <SelectItem value="gujarati">ગુજરાતી</SelectItem>
                      <SelectItem value="malayalam">മലയാളം</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddPatient} className="space-y-6">
                <Accordion type="single" collapsible defaultValue="sectionA">
                  {/* Section A */}
                  <AccordionItem value="sectionA">
                    <AccordionTrigger>
                      {formTranslations[language].sectionA}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="space-y-2">
                          <Label>{formTranslations[language].patientInitials} *</Label>
                          <Input
                            placeholder="Please don't enter full name"
                            value={formData.initials}
                            onChange={(e) =>
                              setFormData({ ...formData, initials: e.target.value })
                            }
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{formTranslations[language].age} *</Label>
                          <Input
                            type="number"
                            min="1"
                            max="120"
                            value={formData.age}
                            onChange={(e) =>
                              setFormData({ ...formData, age: e.target.value })
                            }
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{formTranslations[language].gender} *</Label>
                          <Select
                            value={formData.gender}
                            onValueChange={(value) =>
                              setFormData({ ...formData, gender: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={formTranslations[language].selectGender}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">
                                {formTranslations[language].male}
                              </SelectItem>
                              <SelectItem value="Female">
                                {formTranslations[language].female}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="space-y-2">
                          <Label>{formTranslations[language].heightFeet} *</Label>
                          <Input
                            type="number"
                            min="3"
                            max="6"
                            value={formData.height_feet}
                            onChange={(e) =>
                              setFormData({ ...formData, height_feet: e.target.value })
                            }
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{formTranslations[language].heightInches} *</Label>
                          <Input
                            type="number"
                            min="0"
                            max="11"
                            value={formData.height_inches}
                            onChange={(e) =>
                              setFormData({ ...formData, height_inches: e.target.value })
                            }
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{formTranslations[language].weightKg} *</Label>
                          <Input
                            type="number"
                            min="20"
                            max="300"
                            step="0.1"
                            value={formData.weight_kg}
                            onChange={(e) =>
                              setFormData({ ...formData, weight_kg: e.target.value })
                            }
                            required
                          />
                        </div>
                      </div>

                      {/* Co-morbidities */}
                      <div className="mt-4">
                        <Label className="text-base font-semibold">
                          {formTranslations[language].comorbiditiesLabel}
                        </Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                          {[
                            { key: "diabetes", label: formTranslations[language].diabetes },
                            {
                              key: "hypertension",
                              label: formTranslations[language].hypertension,
                            },
                            {
                              key: "hypothyroidism",
                              label: formTranslations[language].hypothyroidism,
                            },
                            {
                              key: "hyperthyroidism",
                              label: formTranslations[language].hyperthyroidism,
                            },
                            { key: "pcos", label: formTranslations[language].pcos },
                          ].map(({ key, label }) => (
                            <div key={key} className="flex items-center space-x-2">
                              <Checkbox
                                id={key}
                                checked={formData[key as keyof typeof formData] as boolean}
                                onCheckedChange={(checked) =>
                                  setFormData({
                                    ...formData,
                                    [key]: checked as boolean,
                                  })
                                }
                              />
                              <Label htmlFor={key}>{label}</Label>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 space-y-2">
                          <Label>{formTranslations[language].otherComorbidityLabel}</Label>
                          <Input
                            placeholder="Specify any other condition"
                            value={formData.other_comorbidity}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                other_comorbidity: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Section B */}
                  <AccordionItem value="sectionB">
                    <AccordionTrigger>
                      {formTranslations[language].sectionB}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="mt-4 space-y-4">
                        {/* Q3: Skin Tone */}
                        <div>
                          <Label>
                            {typeof formTranslations[language].questions.q3 === "string"
                              ? formTranslations[language].questions.q3
                              : formTranslations[language].questions.q3.text}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q3}
                            onValueChange={(v) => setFormData({ ...formData, q3: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dark">
                                {formTranslations[language].dark}
                              </SelectItem>
                              <SelectItem value="wheatish">
                                {formTranslations[language].wheatish}
                              </SelectItem>
                              <SelectItem value="fair">
                                {formTranslations[language].fair}
                              </SelectItem>
                              <SelectItem value="very_fair">
                                {formTranslations[language].veryFair}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Q4: Clothing Style */}
                        <div>
                          <Label>
                            {typeof formTranslations[language].questions.q4 === "string"
                              ? formTranslations[language].questions.q4
                              : formTranslations[language].questions.q4.text}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q4}
                            onValueChange={(v) => setFormData({ ...formData, q4: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="shorts">
                                {formTranslations[language].shorts}
                              </SelectItem>
                              <SelectItem value="partial">
                                {formTranslations[language].partialCoverage}
                              </SelectItem>
                              <SelectItem value="full">
                                {formTranslations[language].fullCoverage}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Q5: Time Outdoors */}
                        <div>
                          <Label>
                            {typeof formTranslations[language].questions.q5 === "string"
                              ? formTranslations[language].questions.q5
                              : formTranslations[language].questions.q5.text}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q5}
                            onValueChange={(v) => setFormData({ ...formData, q5: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="negligible">
                                {formTranslations[language].negligible}
                              </SelectItem>
                              <SelectItem value="less_30">
                                {formTranslations[language].less30Min}
                              </SelectItem>
                              <SelectItem value="more_30">
                                {formTranslations[language].more30Min}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Q6: Sunscreen */}
                        <div>
                          <Label>
                            {formTranslations[language].questions.q6}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q6}
                            onValueChange={(v) => setFormData({ ...formData, q6: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">
                                {formTranslations[language].yes}
                              </SelectItem>
                              <SelectItem value="no">
                                {formTranslations[language].no}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Q7: Pollution */}
                        <div>
                          <Label>
                            {formTranslations[language].questions.q7}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q7}
                            onValueChange={(v) => setFormData({ ...formData, q7: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">
                                {formTranslations[language].yes}
                              </SelectItem>
                              <SelectItem value="no">
                                {formTranslations[language].no}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Q8: Animal Foods */}
                        <div>
                          <Label>
                            {typeof formTranslations[language].questions.q8 === "string"
                              ? formTranslations[language].questions.q8
                              : formTranslations[language].questions.q8.text}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q8}
                            onValueChange={(v) => setFormData({ ...formData, q8: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no_intake">
                                {formTranslations[language].noIntake}
                              </SelectItem>
                              <SelectItem value="occasional">
                                {formTranslations[language].occasionalIntake}
                              </SelectItem>
                              <SelectItem value="regular">
                                {formTranslations[language].regularIntake}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Q9–Q12: Yes/No */}
                        <div>
                          <Label>
                            {formTranslations[language].questions.q9}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q9}
                            onValueChange={(v) => setFormData({ ...formData, q9: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">
                                {formTranslations[language].yes}
                              </SelectItem>
                              <SelectItem value="no">
                                {formTranslations[language].no}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>
                            {formTranslations[language].questions.q10}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q10}
                            onValueChange={(v) => setFormData({ ...formData, q10: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">
                                {formTranslations[language].yes}
                              </SelectItem>
                              <SelectItem value="no">
                                {formTranslations[language].no}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>
                            {formTranslations[language].questions.q11}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q11}
                            onValueChange={(v) => setFormData({ ...formData, q11: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">
                                {formTranslations[language].yes}
                              </SelectItem>
                              <SelectItem value="no">
                                {formTranslations[language].no}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>
                            {formTranslations[language].questions.q12}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q12}
                            onValueChange={(v) => setFormData({ ...formData, q12: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">
                                {formTranslations[language].yes}
                              </SelectItem>
                              <SelectItem value="no">
                                {formTranslations[language].no}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Q13–Q17: Often/Sometimes/No */}
                        <div>
                          <Label>
                            {typeof formTranslations[language].questions.q13 === "string"
                              ? formTranslations[language].questions.q13
                              : formTranslations[language].questions.q13.text}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q13}
                            onValueChange={(v) => setFormData({ ...formData, q13: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="often">
                                {formTranslations[language].often}
                              </SelectItem>
                              <SelectItem value="sometimes">
                                {formTranslations[language].sometimes}
                              </SelectItem>
                              <SelectItem value="no">
                                {formTranslations[language].no}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>
                            {typeof formTranslations[language].questions.q14 === "string"
                              ? formTranslations[language].questions.q14
                              : formTranslations[language].questions.q14.text}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q14}
                            onValueChange={(v) => setFormData({ ...formData, q14: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="often">
                                {formTranslations[language].often}
                              </SelectItem>
                              <SelectItem value="sometimes">
                                {formTranslations[language].sometimes}
                              </SelectItem>
                              <SelectItem value="no">
                                {formTranslations[language].no}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>
                            {typeof formTranslations[language].questions.q15 === "string"
                              ? formTranslations[language].questions.q15
                              : formTranslations[language].questions.q15.text}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q15}
                            onValueChange={(v) => setFormData({ ...formData, q15: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="often">
                                {formTranslations[language].often}
                              </SelectItem>
                              <SelectItem value="sometimes">
                                {formTranslations[language].sometimes}
                              </SelectItem>
                              <SelectItem value="no">
                                {formTranslations[language].no}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>
                            {typeof formTranslations[language].questions.q16 === "string"
                              ? formTranslations[language].questions.q16
                              : formTranslations[language].questions.q16.text}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q16}
                            onValueChange={(v) => setFormData({ ...formData, q16: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="often">
                                {formTranslations[language].often}
                              </SelectItem>
                              <SelectItem value="sometimes">
                                {formTranslations[language].sometimes}
                              </SelectItem>
                              <SelectItem value="no">
                                {formTranslations[language].no}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>
                            {typeof formTranslations[language].questions.q17 === "string"
                              ? formTranslations[language].questions.q17
                              : formTranslations[language].questions.q17.text}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q17}
                            onValueChange={(v) => setFormData({ ...formData, q17: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="often">
                                {formTranslations[language].often}
                              </SelectItem>
                              <SelectItem value="sometimes">
                                {formTranslations[language].sometimes}
                              </SelectItem>
                              <SelectItem value="no">
                                {formTranslations[language].no}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Q18: Vitamin D Supplementation */}
                        <div>
                          <Label>
                            {formTranslations[language].questions.q18}
                            {" *"}
                          </Label>
                          <Select
                            value={formData.q18}
                            onValueChange={(v) => setFormData({ ...formData, q18: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTranslations[language].select} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">
                                {formTranslations[language].yes}
                              </SelectItem>
                              <SelectItem value="no">
                                {formTranslations[language].no}
                              </SelectItem>
                            </SelectContent>
                          </Select>
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
                      setShowAddForm(false);
                    }}
                  >
                    {formTranslations[language].cancel}
                  </Button>
                  <Button type="submit">
                    <Calculator className="h-4 w-4 mr-2" />
                    {editMode ? "Save Changes" : formTranslations[language].calculate}
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
                      <CardDescription>{patient.initials}</CardDescription>
                    </div>
                    <Badge variant={getRiskBadgeVariant(patient.risk_level)}>
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
                      <span className="text-muted-foreground">Gender:</span>
                      <span className="ml-2 font-medium">{patient.gender}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">BMI:</span>
                      <span className="ml-2 font-medium">
                        {patient.bmi?.toFixed(1) || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Score:</span>
                      <span className="ml-2 font-bold text-primary">
                        {patient.total_score}
                      </span>
                    </div>
                  </div>

                  {(patient.diabetes ||
                    patient.hypertension ||
                    patient.hypothyroidism ||
                    patient.hyperthyroidism ||
                    patient.other_comorbidity) && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Comorbidities:</p>
                      <div className="flex flex-wrap gap-1">
                        {patient.diabetes && (
                          <Badge variant="outline" className="text-xs">
                            Diabetes
                          </Badge>
                        )}
                        {patient.hypertension && (
                          <Badge variant="outline" className="text-xs">
                            Hypertension
                          </Badge>
                        )}
                        {patient.hypothyroidism && (
                          <Badge variant="outline" className="text-xs">
                            Hypothyroidism
                          </Badge>
                        )}
                        {patient.hyperthyroidism && (
                          <Badge variant="outline" className="text-xs">
                            Hyperthyroidism
                          </Badge>
                        )}
                        {patient.pcos && (
                          <Badge variant="outline" className="text-xs">
                            PCOS
                          </Badge>
                        )}
                        {patient.other_comorbidity && (
                          <Badge variant="outline" className="text-xs">
                            {patient.other_comorbidity}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

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
                  <p className="text-sm text-muted-foreground">Adequate</p>
                  <p className="text-xl font-bold text-green-600">
                    {patients.filter((p) => p.risk_level === "Adequate").length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inadequate</p>
                  <p className="text-xl font-bold text-red-600">
                    {patients.filter((p) => p.risk_level === "Inadequate").length}
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
              <Label>No. of Patients with Adequate Vitamin D Levels</Label>
              <Input value={summaryForm.adequate_patients} readOnly />
            </div>

            <div>
              <Label>No. of Patients with Inadequate Vitamin D Levels</Label>
              <Input value={summaryForm.inadequate_patients} readOnly />
            </div>

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
            </div>
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
