import { api } from "@/lib/api";

interface CampWithDoctor {
  id: string;
  camp_date: string;
  status: string;
  total_patients: number;
  adequate_patients?: number;
  inadequate_patients?: number;
  doctor: {
    name: string;
    specialty: string | null;
    clinic_name: string | null;
    clinic_address: string | null;
    city: string | null;
    phone: string;
    whatsapp_number: string | null;
  };
}

interface Patient {
  id: string;
  camp_id: string;
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
  other_comorbidity: string | null;
  total_score: number;
  risk_level: string | null;
  questionnaire_responses: any;
  created_at: string;
}

/**
 * Fetch camp details with doctor information
 * @param campId - The unique camp ID
 * @returns Camp data with nested doctor information
 * @throws Error if fetch fails
 */
export const fetchCampWithDoctor = async (
  campId: string
): Promise<CampWithDoctor> => {
  if (!campId || typeof campId !== "string") {
    throw new Error("Invalid camp ID provided");
  }

  try {
    const data = await api.getCampById(campId);

    if (!data) {
      throw new Error("Camp not found");
    }

    // Transform the data to match expected structure
    return {
      ...data,
      doctor: data.doctors,
    } as CampWithDoctor;
  } catch (err: any) {
    console.error("Error fetching camp with doctor:", err);
    throw new Error(err?.message || "Failed to fetch camp details");
  }
};

/**
 * Fetch all patients for a specific camp
 * @param campId - The unique camp ID
 * @returns Array of patient records
 * @throws Error if fetch fails
 */
export const fetchCampPatients = async (campId: string): Promise<Patient[]> => {
  if (!campId || typeof campId !== "string") {
    throw new Error("Invalid camp ID provided");
  }

  try {
    const data = await api.getPatientsByCamp(campId);

    return (data || []) as Patient[];
  } catch (err: any) {
    console.error("Error fetching camp patients:", err);
    throw new Error(err?.message || "Failed to fetch patients");
  }
};

/**
 * Calculate BMI from weight and height
 * @param weightKg - Weight in kilograms
 * @param heightM - Height in meters
 * @returns BMI rounded to 2 decimal places
 */
export const calculateBMI = (weightKg: number, heightM: number): number => {
  if (heightM <= 0 || weightKg <= 0) return 0;
  return Math.round((weightKg / (heightM * heightM)) * 100) / 100;
};

/**
 * Determine risk level based on total score
 * @param totalScore - Total questionnaire score
 * @returns Risk level string
 */
export const getRiskLevel = (totalScore: number): string => {
  return totalScore < 5 ? "Adequate" : "Inadequate";
};

/**
 * Format phone number to international format
 * @param phone - Phone number
 * @returns Formatted phone number with country code
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return "";
  return phone.startsWith("+") ? phone : `+91${phone}`;
};

/**
 * Get badge variant based on status
 * @param status - Camp or patient status
 * @returns Badge variant
 */
export const getStatusBadgeVariant = (
  status: string
): "default" | "destructive" | "secondary" | "outline" => {
  switch (status?.toLowerCase()) {
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

/**
 * Get badge variant based on risk level
 * @param riskLevel - Patient risk level
 * @returns Badge variant
 */
export const getRiskBadgeVariant = (
  riskLevel: string | null
): "default" | "destructive" | "secondary" | "outline" => {
  switch (riskLevel) {
    case "Adequate":
      return "secondary";
    case "Inadequate":
      return "destructive";
    default:
      return "outline";
  }
};

/**
 * Validate form data for patient creation
 * @param formData - Patient form data
 * @returns True if valid, false otherwise
 */
export const validatePatientFormData = (formData: {
  initials: string;
  age: string;
  gender: string;
  weight_kg: string;
}): boolean => {
  return !!(
    formData.initials?.trim() &&
    formData.age &&
    Number(formData.age) > 0 &&
    Number(formData.age) <= 120 &&
    formData.gender &&
    formData.weight_kg &&
    Number(formData.weight_kg) > 0
  );
};

/**
 * Debounce function for performance optimization
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Calculate Section B score based on questionnaire responses
 * @param formData - Questionnaire responses
 * @param age - Patient age
 * @param bmi - Patient BMI
 * @returns Total score
 */
export const calculateSectionBScore = (
  formData: Record<string, any>,
  age: number,
  bmi: number
): number => {
  let score = 0;

  // Q1: Age > 50?
  if (formData.q1 === "yes") score += 0.5;

  // Q2: BMI ≥ 30?
  if (formData.q2 === "yes") score += 1;

  // Q3: Skin tone
  const skinToneScores: Record<string, number> = {
    dark: 0,
    wheatish: 0.25,
    fair: 0.75,
    very_fair: 1,
  };
  score += skinToneScores[formData.q3] || 0;

  // Q4: Clothing style
  const clothingScores: Record<string, number> = {
    shorts: 0,
    partial: 1,
    full: 3,
  };
  score += clothingScores[formData.q4] || 0;

  // Q5: Time outdoors
  const outdoorScores: Record<string, number> = {
    more_30: 0,
    less_30: 2,
    negligible: 3,
  };
  score += outdoorScores[formData.q5] || 0;

  // Q6: Sunscreen (Yes/No)
  if (formData.q6 === "yes") score += 1;

  // Q7: Pollution (Yes/No)
  if (formData.q7 === "yes") score += 1;

  // Q8: Animal foods
  const foodScores: Record<string, number> = {
    no_intake: 1,
    occasional: 0.5,
    regular: 0,
  };
  score += foodScores[formData.q8] || 0;

  // Q9-Q12: Yes/No (each Yes = +1)
  ["q9", "q10", "q11", "q12"].forEach((q) => {
    if (formData[q] === "yes") score += 1;
  });

  // Q13-Q17: No/Sometimes/Often (0, 0.25, 0.5)
  ["q13", "q14", "q15", "q16", "q17"].forEach((q) => {
    if (formData[q] === "sometimes") score += 0.25;
    else if (formData[q] === "often") score += 0.5;
  });

  // Q18: Vitamin D supplementation (Yes = -5)
  if (formData.q18 === "yes") score -= 5;

  // Ensure score is not negative
  return Math.max(0, score);
};

/**
 * Generate WhatsApp message for doctor
 * @param doctorName - Doctor's name
 * @param clinicName - Clinic name
 * @param city - City
 * @param campDate - Camp date
 * @param totalPatients - Total patients screened
 * @param adequate - Adequate patients count
 * @param inadequate - Inadequate patients count
 * @returns Formatted WhatsApp message
 */
export const generateDoctorWhatsAppMessage = (
  doctorName: string,
  clinicName: string,
  city: string,
  campDate: string,
  totalPatients: number,
  adequate: number,
  inadequate: number
): string => {
  return `
Dear Dr. ${doctorName},

Please find below the summary of the Vitamin D Adequacy Screening Camp conducted at your clinic (${clinicName}, ${city}) on ${new Date(
    campDate
  ).toLocaleDateString()}.

Total Patients Screened: ${totalPatients}
Adequate: ${adequate}
Inadequate: ${inadequate}

------------------------------
ADEQUACY GUIDE:
Score < 5   → Adequate
Score ≥ 5   → Inadequate
------------------------------

We thank you for your kind support and continuous patronage.
For any concerns, please contact 9000000000.

— Vitamin D Awareness Team
  `.trim();
};

/**
 * Send WhatsApp message
 * @param phone - Phone number
 * @param message - Message text
 */
export const sendWhatsAppMessage = (phone: string, message: string): void => {
  const formattedPhone = formatPhoneNumber(phone);
  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(
    message
  )}`;
  window.open(url, "_blank", "noopener,noreferrer");
};