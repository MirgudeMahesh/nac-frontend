// ============================================================
// CREATECAMPINLINE.TSX - Territory-Based Doctor Filtering (BE + BM Support)
// ============================================================
import { useState, useEffect, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Calendar, Phone, AlertCircle, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Doctor {
  id: string;
  name: string;
  specialty: string | null;
  clinic_name: string | null;
  clinic_address: string | null;
  city: string | null;
  Territory: string | null;
  phone: string;
  whatsapp_number: string | null;
}

interface Props {
  onSuccess: (campId: string) => void;
}

interface User {
  id: string;
  email: string;
  imacx_id: string;
  loginTime: string;
  role: string;
  territory?: string;
  beterritory?: string;
  name?: string;
  phone?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];

const CreateCampInline = memo(({ onSuccess }: Props) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [campDate, setCampDate] = useState("");
  const [doctorWhatsApp, setDoctorWhatsApp] = useState<string>("");
  const [consentFile, setConsentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);
  const [userTerritory, setUserTerritory] = useState<string | null>(null);
  const [territoryError, setTerritoryError] = useState<string | null>(null);
  const [open, setOpen] = useState(false); // ✅ For popover control
  const { toast } = useToast();

  // ✅ Get user from localStorage
  const getCurrentUser = useCallback((): User | null => {
    try {
      const storedUser = localStorage.getItem("vitaminDUser");
      if (!storedUser) return null;
      return JSON.parse(storedUser);
    } catch (err) {
      console.error("Error parsing user data:", err);
      return null;
    }
  }, []);

  // ✅ Fetch user's territory - handles both BE and BM
  const fetchUserTerritory = useCallback(async () => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        setTerritoryError("User not found. Please log in again.");
        return;
      }

      const role = currentUser.role;

      if (role === "BE") {
        // BE user - get single territory from users table
        let data = null;
        try {
          data = await api.getUserByImacxId(currentUser.imacx_id);
        } catch (error) { throw error; }

        setUserTerritory(data?.territory || null);

        if (!data?.territory) {
          setTerritoryError(
            "Your territory is not set. Please contact administrator."
          );
        }

        console.log(`BE user territory: ${data?.territory}`);
      } else if (role === "BM") {
        // BM user - get BM's territory from localStorage
        const bmTerritory = currentUser.territory; // e.g., "bm1"

        if (!bmTerritory) {
          setTerritoryError("BM territory not found in session.");
          return;
        }

        console.log(`Fetching all BEs under BM territory: ${bmTerritory}`);

        // ✅ Find ALL rows where territory matches BM's territory
        let data = null;
        try {
          data = await api.getBmUsersByTerritory(bmTerritory);
        } catch (error) { throw error; }

        if (!data || data.length === 0) {
          setTerritoryError(
            `No BEs found under your territory (${bmTerritory}).`
          );
          return;
        }

        console.log(`Found ${data.length} BEs under BM ${bmTerritory}`);

        // ✅ Collect all unique BE territories
        const allTerritories = data
          .map((row) => row.beterritory)
          .filter((t) => t && t.trim().length > 0)
          .join(",");

        setUserTerritory(allTerritories || null);

        if (!allTerritories) {
          setTerritoryError(
            "No BE territories assigned. Please contact administrator."
          );
        }

        console.log(`BM manages BE territories: ${allTerritories}`);
      } else {
        setTerritoryError("Invalid user role. Please contact administrator.");
      }
    } catch (err: any) {
      console.error("Error fetching user territory:", err);
      setTerritoryError(
        err?.message || "Failed to fetch your territory information"
      );
      toast({
        title: "Territory Error",
        description:
          err?.message || "Failed to fetch your territory information",
        variant: "destructive",
      });
    }
  }, [getCurrentUser, toast]);

  // ✅ Fetch doctors - handles single territory (BE) or multiple territories (BM)
  const fetchDoctors = useCallback(async () => {
    if (!userTerritory) {
      setLoadingDoctors(false);
      return;
    }

    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error("User not found");
      }

      const role = currentUser.role;

      let data = null;
      let error = null;
      try {
        if (role === "BM") {
          const territories = userTerritory.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
          if (territories.length === 0) {
            setTerritoryError("No valid territories found.");
            setDoctors([]);
            setLoadingDoctors(false);
            return;
          }
          data = await api.getDoctorsByTerritories(territories);
        } else {
          data = await api.getDoctorsByTerritory(userTerritory);
        }
      } catch (err: any) { error = err; }
      if (error) throw error;

      if (!data || data.length === 0) {
        if (role === "BM") {
          setTerritoryError(
            `No doctors found in your BE territories (${userTerritory}).`
          );
        } else {
          setTerritoryError(
            `No doctors found in your territory (${userTerritory}).`
          );
        }
      } else {
        setTerritoryError(null);
      }

      setDoctors(data || []);
      console.log(`Found ${data?.length || 0} doctors for ${role} user`);
    } catch (err: any) {
      console.error("Error fetching doctors:", err);
      toast({
        title: "Error fetching doctors",
        description: err?.message || "Failed to load doctors",
        variant: "destructive",
      });
    } finally {
      setLoadingDoctors(false);
    }
  }, [userTerritory, getCurrentUser, toast]);

  // ✅ Fetch user territory on mount
  useEffect(() => {
    fetchUserTerritory();
  }, [fetchUserTerritory]);

  // ✅ Fetch doctors when territory is loaded
  useEffect(() => {
    if (userTerritory) {
      fetchDoctors();
    }
  }, [userTerritory, fetchDoctors]);

  // Handle doctor selection
  const handleDoctorSelect = useCallback(
    (id: string) => {
      setSelectedDoctorId(id);
      const doc = doctors.find((d) => d.id === id) || null;
      setSelectedDoctor(doc);
      setDoctorWhatsApp(doc?.whatsapp_number || doc?.phone || "");
    },
    [doctors]
  );

  // Validate file
  const validateFile = useCallback((file: File): boolean => {
    setFileError(null);

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setFileError("Only JPG, PNG, and PDF files are allowed");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError("File size must be less than 5MB");
      return false;
    }

    return true;
  }, []);

  // Handle file selection
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      if (file && validateFile(file)) {
        setConsentFile(file);
      } else {
        setConsentFile(null);
        e.target.value = "";
      }
    },
    [validateFile]
  );

  // Upload consent form
  const uploadConsentForm = useCallback(
    async (file: File, campId: string): Promise<string> => {
      try {
        const fileExt = file.name.split(".").pop();
        const newFileName = `${campId}.${fileExt}`;
        const renamedFile = new File([file], newFileName, { type: file.type });
        const filePath = await api.uploadFile(renamedFile);

        return filePath;
      } catch (err: any) {
        console.error("File upload error:", err);
        throw new Error(err?.message || "Failed to upload consent form");
      }
    },
    []
  );

  // Determine camp status
  const determineCampStatus = useCallback((campDate: string): string => {
    const today = new Date();
    const selectedDate = new Date(campDate);
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate > today ? "scheduled" : "active";
  }, []);

  // Send WhatsApp message
  const sendWhatsAppMessage = useCallback(
    (doctor: Doctor, campDate: string) => {
      const phone = doctor.whatsapp_number || doctor.phone;
      if (!phone) return;

      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
      const message = `
Dear Dr. ${doctor?.name || ""},

Thank you for your consent to conduct Vitamin D Risk Assessment Camp at your clinic on ${new Date(
        campDate
      ).toLocaleDateString()}.

We will initiate screening patients for their risk of Vitamin D deficiency shortly.
Once the camp concludes, we'll share a brief summary report highlighting the number of patients screened and key findings.

Thank you for partnering with Pulse Pharmaceuticals in this mission to make India Vitamin D deficiency-free.

Team Pulse Pharmaceuticals
Your Partner in Vitamin D Management
`.trim();

      window.open(
        `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`,
        "_blank"
      );
    },
    []
  );

  // Create camp
  const handleCreateCamp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!selectedDoctorId || !campDate) {
        toast({
          title: "Missing information",
          description: "Please select a doctor and camp date.",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
          toast({
            title: "Authentication Error",
            description: "Please log in again.",
            variant: "destructive",
          });
          return;
        }

        // ✅ Debug log
        console.log("Creating camp with user:", currentUser);
        console.log("User ID:", currentUser.id, "Type:", typeof currentUser.id);

        // Update doctor's WhatsApp number
        if (doctorWhatsApp) {
          try {
            await api.updateDoctor(selectedDoctorId, { whatsapp_number: doctorWhatsApp });
          } catch (updateError: any) {
            console.warn(
              "Failed to update doctor's WhatsApp number:",
              updateError.message
            );
          }
        }

        // Determine camp status
        const initialStatus = determineCampStatus(campDate);

        // Create camp
        let camp = null;
        try {
          camp = await api.createCamp({
            user_id: currentUser.id,
            doctor_id: selectedDoctorId,
            camp_date: campDate,
            status: initialStatus,
            total_patients: 0,
          });
        } catch (campError) {
          console.error("Camp creation error:", campError);
          throw campError;
        }

        // Upload consent file
        if (consentFile) {
          const filePath = await uploadConsentForm(consentFile, camp.id);

          try {
            await api.updateCamp(camp.id, { consent_form_url: filePath });
          } catch (updateError) { throw updateError; }
        }

        // Send WhatsApp message
        if (selectedDoctor) {
          const updatedDoctor = {
            ...selectedDoctor,
            whatsapp_number: doctorWhatsApp,
          };
          sendWhatsAppMessage(updatedDoctor, campDate);
        }

        toast({
          title: "Camp created successfully!",
          description:
            initialStatus === "scheduled"
              ? "Camp scheduled successfully."
              : "Camp created and active! Redirecting to patient registration...",
        });

        onSuccess(camp.id);
      } catch (err: any) {
        console.error("Camp creation error:", err);
        toast({
          title: "Error creating camp",
          description: err?.message || "Failed to create camp",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [
      selectedDoctorId,
      campDate,
      consentFile,
      selectedDoctor,
      doctorWhatsApp,
      determineCampStatus,
      uploadConsentForm,
      sendWhatsAppMessage,
      getCurrentUser,
      onSuccess,
      toast,
    ]
  );

  const today = new Date().toISOString().split("T")[0];
  const currentUser = getCurrentUser();

  return (
    <form onSubmit={handleCreateCamp} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-primary" /> Camp Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ✅ Territory Display */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {currentUser?.role === "BM" ? "Your BE Territories: " : "Your Territory: "}
                  <span className="font-bold">
                    {userTerritory || "Loading..."}
                  </span>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {currentUser?.role === "BM"
                    ? "You can create camps with doctors from all your BE territories."
                    : "You can only create camps with doctors assigned to your territory."}
                </p>
              </div>
            </div>
          </div>

          {/* ✅ Territory Error Display */}
          {territoryError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{territoryError}</p>
            </div>
          )}

          {/* ✅ Enhanced Searchable Doctor Selection */}
          <div className="space-y-2">
            <Label htmlFor="doctor-select">
              Select Doctor <span className="text-destructive">*</span>
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between h-10 px-3 py-2"
                  disabled={loadingDoctors || !userTerritory || doctors.length === 0}
                >
                  <span className="truncate text-left">
                    {selectedDoctorId
                      ? doctors.find((doctor) => doctor.id === selectedDoctorId)
                        ?.name
                      : loadingDoctors
                        ? "Loading doctors..."
                        : doctors.length === 0
                          ? "No doctors in your territory"
                          : "Choose a doctor"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-full p-0 shadow-lg border-2 border-green-500"
                align="start"
                side="bottom"
              >
                <Command>
                  <CommandInput
                    placeholder="Search doctor by name or clinic..."
                    className="h-10 px-3 border-b"
                  />
                  <CommandList className="max-h-60 overflow-y-auto">
                    <CommandEmpty className="p-4 text-center text-gray-500">
                      No doctor found.
                    </CommandEmpty>
                    <CommandGroup className="p-0">
                      {doctors.map((doctor) => (
                        <CommandItem
                          key={doctor.id}
                          value={`${doctor.name} ${doctor.clinic_name} ${doctor.city
                            } ${doctor.Territory || ""}`}
                          onSelect={() => {
                            handleDoctorSelect(doctor.id);
                            setOpen(false);
                          }}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-green-50 border-b last:border-b-0 transition-colors"
                        >
                          <Check
                            className={cn(
                              "h-5 w-5 flex-shrink-0",
                              selectedDoctorId === doctor.id
                                ? "opacity-100 text-green-600 font-bold"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 truncate">
                                {doctor.name}
                              </span>
                              {doctor.specialty && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded flex-shrink-0">
                                  {doctor.specialty}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                              <div className="truncate">
                                📍 {doctor.clinic_name || "N/A"}, {doctor.city || "N/A"}
                              </div>
                              <div className="truncate">
                                📍 Territory: {doctor.Territory || "N/A"}
                              </div>
                              {doctor.phone && (
                                <div className="truncate">
                                  📱 {doctor.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-gray-600 mt-1">
              <strong>{doctors.length}</strong> doctor{doctors.length !== 1 ? "s" : ""}{" "}
              available
              {currentUser?.role === "BM" ? " in your BE territories" : " in your territory"}
            </p>
          </div>

          {/* Auto-filled fields */}
          {selectedDoctor && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gradient-to-br from-green-50 to-teal-50 rounded-lg border border-green-200">
              <div>
                <Label className="text-gray-700 font-semibold">Specialty</Label>
                <Input
                  value={selectedDoctor.specialty || "N/A"}
                  readOnly
                  className="mt-1 bg-white border-green-300"
                />
              </div>
              <div>
                <Label className="text-gray-700 font-semibold">Territory</Label>
                <Input
                  value={selectedDoctor.Territory || "N/A"}
                  readOnly
                  className="mt-1 bg-white border-green-300"
                />
              </div>
              <div>
                <Label className="text-gray-700 font-semibold">
                  Doctor Mobile
                </Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-600" />
                  <Input
                    className="pl-10 bg-white border-green-300"
                    value={selectedDoctor.phone || "N/A"}
                    readOnly
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-700 font-semibold">
                  WhatsApp Number <span className="text-destructive">*</span>
                </Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-600" />
                  <Input
                    type="tel"
                    value={doctorWhatsApp}
                    onChange={(e) => setDoctorWhatsApp(e.target.value)}
                    placeholder="Enter WhatsApp number"
                    className="pl-10 bg-white border-green-300 focus:border-green-500 focus:ring-green-200"
                    required
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-700 font-semibold">Clinic Name</Label>
                <Input
                  value={selectedDoctor.clinic_name || "N/A"}
                  readOnly
                  className="mt-1 bg-white border-green-300"
                />
              </div>
              <div>
                <Label className="text-gray-700 font-semibold">
                  Clinic Address
                </Label>
                <Input
                  value={selectedDoctor.clinic_address || "N/A"}
                  readOnly
                  className="mt-1 bg-white border-green-300"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-gray-700 font-semibold">City</Label>
                <Input
                  value={selectedDoctor.city || "N/A"}
                  readOnly
                  className="mt-1 bg-white border-green-300"
                />
              </div>
            </div>
          )}

          {/* Camp Date */}
          <div>
            <Label htmlFor="camp-date" className="text-gray-700 font-semibold">
              Camp Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="camp-date"
              type="date"
              value={campDate}
              onChange={(e) => setCampDate(e.target.value)}
              required
              min={today}
              className="mt-2 border-green-300 focus:border-green-500 focus:ring-green-200"
            />
          </div>

          {/* Consent Form */}
          <div>
            <Label htmlFor="consent-file" className="text-gray-700 font-semibold">
              Upload Consent Form
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="consent-file"
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              required
              className="mt-2 border-green-300 focus:border-green-500 focus:ring-green-200"
            />
            {fileError && (
              <p className="text-sm text-red-600 mt-2 font-medium">{fileError}</p>
            )}
            {consentFile && !fileError && (
              <p className="text-sm text-green-700 mt-2 font-medium">
                ✓ Selected: {consentFile.name} (
                {(consentFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={
                loading ||
                !selectedDoctorId ||
                !campDate ||
                consentFile === null ||
                !userTerritory ||
                !doctorWhatsApp
              }
              className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600 text-white font-semibold px-8 py-2 rounded-lg transition-all shadow-md"
            >
              {loading ? "Creating..." : "Create Camp"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
});

CreateCampInline.displayName = "CreateCampInline";

export default CreateCampInline;






















// ============================================================
// CREATECAMPINLINE.TSX - Territory-Based Doctor Filtering (BE + BM Support)
// ============================================================
// import { useState, useEffect, useCallback, memo } from "react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Label } from "@/components/ui/label";
// import {
//   Command,
//   CommandEmpty,
//   CommandGroup,
//   CommandInput,
//   CommandItem,
//   CommandList,
// } from "@/components/ui/command";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover";
// import { useToast } from "@/hooks/use-toast";
// import { supabase } from "@/integrations/supabase/client";
// import { Calendar, Phone, AlertCircle, Check, ChevronsUpDown } from "lucide-react";
// import { cn } from "@/lib/utils";

// interface Doctor {
//   id: string;
//   name: string;
//   specialty: string | null;
//   clinic_name: string | null;
//   clinic_address: string | null;
//   city: string | null;
//   Territory: string | null;
//   phone: string;
//   whatsapp_number: string | null;
// }

// interface Props {
//   onSuccess: (campId: string) => void;
// }

// interface User {
//   id: string;
//   email: string;
//   imacx_id: string;
//   loginTime: string;
//   role: string;
//   territory?: string;
//   beterritory?: string;
//   name?: string;
//   phone?: string;
// }

// const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
// const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];

// const CreateCampInline = memo(({ onSuccess }: Props) => {
//   const [doctors, setDoctors] = useState<Doctor[]>([]);
//   const [selectedDoctorId, setSelectedDoctorId] = useState("");
//   const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
//   const [campDate, setCampDate] = useState("");
//   const [doctorWhatsApp, setDoctorWhatsApp] = useState<string>("");
//   const [consentFile, setConsentFile] = useState<File | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [loadingDoctors, setLoadingDoctors] = useState(true);
//   const [fileError, setFileError] = useState<string | null>(null);
//   const [userTerritory, setUserTerritory] = useState<string | null>(null);
//   const [territoryError, setTerritoryError] = useState<string | null>(null);
//   const [open, setOpen] = useState(false); // ✅ For popover control
//   const { toast } = useToast();

//   // ✅ Get user from localStorage
//   const getCurrentUser = useCallback((): User | null => {
//     try {
//       const storedUser = localStorage.getItem("vitaminDUser");
//       if (!storedUser) return null;
//       return JSON.parse(storedUser);
//     } catch (err) {
//       console.error("Error parsing user data:", err);
//       return null;
//     }
//   }, []);

//   // ✅ Fetch user's territory - handles both BE and BM
//   const fetchUserTerritory = useCallback(async () => {
//     try {
//       const currentUser = getCurrentUser();
//       if (!currentUser) {
//         setTerritoryError("User not found. Please log in again.");
//         return;
//       }

//       const role = currentUser.role;

//       if (role === "BE") {
//         // BE user - get single territory from users table
//         const { data, error } = await supabase
//           .from("users")
//           .select("territory")
//           .eq("id", currentUser.id)
//           .single();

//         if (error) throw error;

//         setUserTerritory(data?.territory || null);

//         if (!data?.territory) {
//           setTerritoryError(
//             "Your territory is not set. Please contact administrator."
//           );
//         }

//         console.log(`BE user territory: ${data?.territory}`);
//       } else if (role === "BM") {
//         // BM user - get BM's territory from localStorage
//         const bmTerritory = currentUser.territory; // e.g., "bm1"

//         if (!bmTerritory) {
//           setTerritoryError("BM territory not found in session.");
//           return;
//         }

//         console.log(`Fetching all BEs under BM territory: ${bmTerritory}`);

//         // ✅ Find ALL rows where territory matches BM's territory
//         const { data, error } = await supabase
//           .from("usersbm")
//           .select("beterritory")
//           .eq("territory", bmTerritory);

//         if (error) throw error;

//         if (!data || data.length === 0) {
//           setTerritoryError(
//             `No BEs found under your territory (${bmTerritory}).`
//           );
//           return;
//         }

//         console.log(`Found ${data.length} BEs under BM ${bmTerritory}`);

//         // ✅ Collect all unique BE territories
//         const allTerritories = data
//           .map((row) => row.beterritory)
//           .filter((t) => t && t.trim().length > 0)
//           .join(",");

//         setUserTerritory(allTerritories || null);

//         if (!allTerritories) {
//           setTerritoryError(
//             "No BE territories assigned. Please contact administrator."
//           );
//         }

//         console.log(`BM manages BE territories: ${allTerritories}`);
//       } else {
//         setTerritoryError("Invalid user role. Please contact administrator.");
//       }
//     } catch (err: any) {
//       console.error("Error fetching user territory:", err);
//       setTerritoryError(
//         err?.message || "Failed to fetch your territory information"
//       );
//       toast({
//         title: "Territory Error",
//         description:
//           err?.message || "Failed to fetch your territory information",
//         variant: "destructive",
//       });
//     }
//   }, [getCurrentUser, toast]);

//   // ✅ Fetch doctors - handles single territory (BE) or multiple territories (BM)
//   const fetchDoctors = useCallback(async () => {
//     if (!userTerritory) {
//       setLoadingDoctors(false);
//       return;
//     }

//     try {
//       const currentUser = getCurrentUser();
//       if (!currentUser) {
//         throw new Error("User not found");
//       }

//       const role = currentUser.role;

//       let query = supabase
//         .from("doctors")
//         .select("*")
//         .eq("is_selected_by_marketing", true);

//       if (role === "BM") {
//         // ✅ BM user - filter by multiple territories
//         const territories = userTerritory
//           .split(",")
//           .map((t) => t.trim())
//           .filter((t) => t.length > 0);

//         if (territories.length === 0) {
//           setTerritoryError("No valid territories found.");
//           setDoctors([]);
//           setLoadingDoctors(false);
//           return;
//         }

//         // Use .in() to match doctors from ANY of the BE territories
//         query = query.in("Territory", territories);

//         console.log(
//           `BM fetching doctors from ${territories.length} territories:`,
//           territories
//         );
//       } else {
//         // ✅ BE user - filter by single territory
//         query = query.eq("Territory", userTerritory);
//         console.log(`BE fetching doctors from territory: ${userTerritory}`);
//       }

//       const { data, error } = await query.order("name");

//       if (error) throw error;

//       if (!data || data.length === 0) {
//         if (role === "BM") {
//           setTerritoryError(
//             `No doctors found in your BE territories (${userTerritory}).`
//           );
//         } else {
//           setTerritoryError(
//             `No doctors found in your territory (${userTerritory}).`
//           );
//         }
//       } else {
//         setTerritoryError(null);
//       }

//       setDoctors(data || []);
//       console.log(`Found ${data?.length || 0} doctors for ${role} user`);
//     } catch (err: any) {
//       console.error("Error fetching doctors:", err);
//       toast({
//         title: "Error fetching doctors",
//         description: err?.message || "Failed to load doctors",
//         variant: "destructive",
//       });
//     } finally {
//       setLoadingDoctors(false);
//     }
//   }, [userTerritory, getCurrentUser, toast]);

//   // ✅ Fetch user territory on mount
//   useEffect(() => {
//     fetchUserTerritory();
//   }, [fetchUserTerritory]);

//   // ✅ Fetch doctors when territory is loaded
//   useEffect(() => {
//     if (userTerritory) {
//       fetchDoctors();
//     }
//   }, [userTerritory, fetchDoctors]);

//   // Handle doctor selection
//   const handleDoctorSelect = useCallback(
//     (id: string) => {
//       setSelectedDoctorId(id);
//       const doc = doctors.find((d) => d.id === id) || null;
//       setSelectedDoctor(doc);
//       setDoctorWhatsApp(doc?.whatsapp_number || doc?.phone || "");
//     },
//     [doctors]
//   );

//   // Validate file
//   const validateFile = useCallback((file: File): boolean => {
//     setFileError(null);

//     if (!ALLOWED_FILE_TYPES.includes(file.type)) {
//       setFileError("Only JPG, PNG, and PDF files are allowed");
//       return false;
//     }

//     if (file.size > MAX_FILE_SIZE) {
//       setFileError("File size must be less than 5MB");
//       return false;
//     }

//     return true;
//   }, []);

//   // Handle file selection
//   const handleFileChange = useCallback(
//     (e: React.ChangeEvent<HTMLInputElement>) => {
//       const file = e.target.files?.[0] || null;
//       if (file && validateFile(file)) {
//         setConsentFile(file);
//       } else {
//         setConsentFile(null);
//         e.target.value = "";
//       }
//     },
//     [validateFile]
//   );

//   // Upload consent form
//   const uploadConsentForm = useCallback(
//     async (file: File, campId: string): Promise<string> => {
//       try {
//         const fileExt = file.name.split(".").pop();
//         const fileName = `${campId}.${fileExt}`;
//         const filePath = `consents/${fileName}`;

//         const { error: uploadError } = await supabase.storage
//           .from("consent_forms")
//           .upload(filePath, file, {
//             cacheControl: "3600",
//             upsert: true,
//           });

//         if (uploadError) throw uploadError;

//         return filePath;
//       } catch (err: any) {
//         console.error("File upload error:", err);
//         throw new Error(err?.message || "Failed to upload consent form");
//       }
//     },
//     []
//   );

//   // Determine camp status
//   const determineCampStatus = useCallback((campDate: string): string => {
//     const today = new Date();
//     const selectedDate = new Date(campDate);
//     today.setHours(0, 0, 0, 0);
//     selectedDate.setHours(0, 0, 0, 0);
//     return selectedDate > today ? "scheduled" : "active";
//   }, []);

//   // Send WhatsApp message
//   const sendWhatsAppMessage = useCallback(
//     (doctor: Doctor, campDate: string) => {
//       const phone = doctor.whatsapp_number || doctor.phone;
//       if (!phone) return;

//       const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
//       const message = `
// Dear Dr. ${doctor?.name || ""},

// Thank you for your consent to conduct Vitamin D Risk Assessment Camp at your clinic on ${new Date(
//         campDate
//       ).toLocaleDateString()}.

// We will initiate screening patients for their risk of Vitamin D deficiency shortly.
// Once the camp concludes, we'll share a brief summary report highlighting the number of patients screened and key findings.

// Thank you for partnering with Pulse Pharmaceuticals in this mission to make India Vitamin D deficiency-free.

// Team Pulse Pharmaceuticals
// Your Partner in Vitamin D Management
// `.trim();

//       window.open(
//         `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`,
//         "_blank"
//       );
//     },
//     []
//   );

//   // Create camp
//   const handleCreateCamp = useCallback(
//     async (e: React.FormEvent) => {
//       e.preventDefault();

//       if (!selectedDoctorId || !campDate) {
//         toast({
//           title: "Missing information",
//           description: "Please select a doctor and camp date.",
//           variant: "destructive",
//         });
//         return;
//       }

//       setLoading(true);

//       try {
//         const currentUser = getCurrentUser();
//         if (!currentUser) {
//           toast({
//             title: "Authentication Error",
//             description: "Please log in again.",
//             variant: "destructive",
//           });
//           return;
//         }

//         // ✅ Debug log
//         console.log("Creating camp with user:", currentUser);
//         console.log("User ID:", currentUser.id, "Type:", typeof currentUser.id);

//         // Update doctor's WhatsApp number
//         if (doctorWhatsApp) {
//           const { error: updateError } = await supabase
//             .from("doctors")
//             .update({ whatsapp_number: doctorWhatsApp })
//             .eq("id", selectedDoctorId);

//           if (updateError) {
//             console.warn(
//               "Failed to update doctor's WhatsApp number:",
//               updateError.message
//             );
//           }
//         }

//         // Determine camp status
//         const initialStatus = determineCampStatus(campDate);

//         // Create camp
//         const { data: camp, error: campError } = await supabase
//           .from("camps")
//           .insert({
//             user_id: currentUser.id,
//             doctor_id: selectedDoctorId,
//             camp_date: campDate,
//             status: initialStatus,
//             total_patients: 0,
//           })
//           .select()
//           .single();

//         if (campError) {
//           console.error("Camp creation error:", campError);
//           throw campError;
//         }

//         // Upload consent file
//         if (consentFile) {
//           const filePath = await uploadConsentForm(consentFile, camp.id);

//           const { error: updateError } = await supabase
//             .from("camps")
//             .update({ consent_form_url: filePath })
//             .eq("id", camp.id);

//           if (updateError) throw updateError;
//         }

//         // Send WhatsApp message
//         if (selectedDoctor) {
//           const updatedDoctor = {
//             ...selectedDoctor,
//             whatsapp_number: doctorWhatsApp,
//           };
//           sendWhatsAppMessage(updatedDoctor, campDate);
//         }

//         toast({
//           title: "Camp created successfully!",
//           description:
//             initialStatus === "scheduled"
//               ? "Camp scheduled successfully."
//               : "Camp created and active! Redirecting to patient registration...",
//         });

//         onSuccess(camp.id);
//       } catch (err: any) {
//         console.error("Camp creation error:", err);
//         toast({
//           title: "Error creating camp",
//           description: err?.message || "Failed to create camp",
//           variant: "destructive",
//         });
//       } finally {
//         setLoading(false);
//       }
//     },
//     [
//       selectedDoctorId,
//       campDate,
//       consentFile,
//       selectedDoctor,
//       doctorWhatsApp,
//       determineCampStatus,
//       uploadConsentForm,
//       sendWhatsAppMessage,
//       getCurrentUser,
//       onSuccess,
//       toast,
//     ]
//   );

//   const today = new Date().toISOString().split("T")[0];
//   const currentUser = getCurrentUser();

//   return (
//     <form onSubmit={handleCreateCamp} className="space-y-6">
//       <Card>
//         <CardHeader>
//           <CardTitle className="flex items-center">
//             <Calendar className="h-5 w-5 mr-2 text-primary" /> Camp Details
//           </CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           {/* ✅ Territory Display */}
//           <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
//             <div className="flex items-start gap-2">
//               <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
//               <div>
//                 <p className="text-sm font-medium text-blue-900">
//                   {currentUser?.role === "BM" ? "Your BE Territories: " : "Your Territory: "}
//                   <span className="font-bold">
//                     {userTerritory || "Loading..."}
//                   </span>
//                 </p>
//                 <p className="text-xs text-blue-700 mt-1">
//                   {currentUser?.role === "BM"
//                     ? "You can create camps with doctors from all your BE territories."
//                     : "You can only create camps with doctors assigned to your territory."}
//                 </p>
//               </div>
//             </div>
//           </div>

//           {/* ✅ Territory Error Display */}
//           {territoryError && (
//             <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
//               <p className="text-sm text-red-700">{territoryError}</p>
//             </div>
//           )}

//           {/* ✅ Enhanced Searchable Doctor Selection */}
//           <div className="space-y-2">
//             <Label htmlFor="doctor-select">
//               Select Doctor <span className="text-destructive">*</span>
//             </Label>
//             <Popover open={open} onOpenChange={setOpen}>
//               <PopoverTrigger asChild>
//                 <Button
//                   variant="outline"
//                   role="combobox"
//                   aria-expanded={open}
//                   className="w-full justify-between h-10 px-3 py-2"
//                   disabled={loadingDoctors || !userTerritory || doctors.length === 0}
//                 >
//                   <span className="truncate text-left">
//                     {selectedDoctorId
//                       ? doctors.find((doctor) => doctor.id === selectedDoctorId)
//                           ?.name
//                       : loadingDoctors
//                       ? "Loading doctors..."
//                       : doctors.length === 0
//                       ? "No doctors in your territory"
//                       : "Choose a doctor"}
//                   </span>
//                   <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
//                 </Button>
//               </PopoverTrigger>
//               <PopoverContent
//                 className="w-full p-0 shadow-lg border-2 border-green-500"
//                 align="start"
//                 side="bottom"
//               >
//                 <Command>
//                   <CommandInput
//                     placeholder="Search doctor by name or clinic..."
//                     className="h-10 px-3 border-b"
//                   />
//                   <CommandList className="max-h-60 overflow-y-auto">
//                     <CommandEmpty className="p-4 text-center text-gray-500">
//                       No doctor found.
//                     </CommandEmpty>
//                     <CommandGroup className="p-0">
//                       {doctors.map((doctor) => (
//                         <CommandItem
//                           key={doctor.id}
//                           value={doctor.name}
//                           onSelect={() => {
//                             handleDoctorSelect(doctor.id);
//                             setOpen(false);
//                           }}
//                           className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-green-50 border-b last:border-b-0 transition-colors"
//                         >
//                           <Check
//                             className={cn(
//                               "h-5 w-5 flex-shrink-0",
//                               selectedDoctorId === doctor.id
//                                 ? "opacity-100 text-green-600 font-bold"
//                                 : "opacity-0"
//                             )}
//                           />
//                           <span className="font-medium text-gray-900">
//                             {doctor.name}
//                           </span>
//                         </CommandItem>
//                       ))}
//                     </CommandGroup>
//                   </CommandList>
//                 </Command>
//               </PopoverContent>
//             </Popover>
//             <p className="text-xs text-gray-600 mt-1">
//               <strong>{doctors.length}</strong> doctor{doctors.length !== 1 ? "s" : ""}{" "}
//               available
//               {currentUser?.role === "BM" ? " in your BE territories" : " in your territory"}
//             </p>
//           </div>

//           {/* Auto-filled fields */}
//           {selectedDoctor && (
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gradient-to-br from-green-50 to-teal-50 rounded-lg border border-green-200">
//               <div>
//                 <Label className="text-gray-700 font-semibold">Specialty</Label>
//                 <Input
//                   value={selectedDoctor.specialty || "N/A"}
//                   readOnly
//                   className="mt-1 bg-white border-green-300"
//                 />
//               </div>
//               <div>
//                 <Label className="text-gray-700 font-semibold">Territory</Label>
//                 <Input
//                   value={selectedDoctor.Territory || "N/A"}
//                   readOnly
//                   className="mt-1 bg-white border-green-300"
//                 />
//               </div>
//               <div>
//                 <Label className="text-gray-700 font-semibold">
//                   Doctor Mobile
//                 </Label>
//                 <div className="relative mt-1">
//                   <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-600" />
//                   <Input
//                     className="pl-10 bg-white border-green-300"
//                     value={selectedDoctor.phone || "N/A"}
//                     readOnly
//                   />
//                 </div>
//               </div>
//               <div>
//                 <Label className="text-gray-700 font-semibold">
//                   WhatsApp Number <span className="text-destructive">*</span>
//                 </Label>
//                 <div className="relative mt-1">
//                   <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-600" />
//                   <Input
//                     type="tel"
//                     value={doctorWhatsApp}
//                     onChange={(e) => setDoctorWhatsApp(e.target.value)}
//                     placeholder="Enter WhatsApp number"
//                     className="pl-10 bg-white border-green-300 focus:border-green-500 focus:ring-green-200"
//                     required
//                   />
//                 </div>
//               </div>
//               <div>
//                 <Label className="text-gray-700 font-semibold">Clinic Name</Label>
//                 <Input
//                   value={selectedDoctor.clinic_name || "N/A"}
//                   readOnly
//                   className="mt-1 bg-white border-green-300"
//                 />
//               </div>
//               <div>
//                 <Label className="text-gray-700 font-semibold">
//                   Clinic Address
//                 </Label>
//                 <Input
//                   value={selectedDoctor.clinic_address || "N/A"}
//                   readOnly
//                   className="mt-1 bg-white border-green-300"
//                 />
//               </div>
//               <div className="md:col-span-2">
//                 <Label className="text-gray-700 font-semibold">City</Label>
//                 <Input
//                   value={selectedDoctor.city || "N/A"}
//                   readOnly
//                   className="mt-1 bg-white border-green-300"
//                 />
//               </div>
//             </div>
//           )}

//           {/* Camp Date */}
//           <div>
//             <Label htmlFor="camp-date" className="text-gray-700 font-semibold">
//               Camp Date <span className="text-destructive">*</span>
//             </Label>
//             <Input
//               id="camp-date"
//               type="date"
//               value={campDate}
//               onChange={(e) => setCampDate(e.target.value)}
//               required
//               min={today}
//               className="mt-2 border-green-300 focus:border-green-500 focus:ring-green-200"
//             />
//           </div>

//           {/* Consent Form */}
//           <div>
//             <Label htmlFor="consent-file" className="text-gray-700 font-semibold">
//               Upload Consent Form
//               <span className="text-destructive">*</span>
//             </Label>
//             <Input
//               id="consent-file"
//               type="file"
//               accept="image/*,.pdf"
//               onChange={handleFileChange}
//               required
//               className="mt-2 border-green-300 focus:border-green-500 focus:ring-green-200"
//             />
//             {fileError && (
//               <p className="text-sm text-red-600 mt-2 font-medium">{fileError}</p>
//             )}
//             {consentFile && !fileError && (
//               <p className="text-sm text-green-700 mt-2 font-medium">
//                 ✓ Selected: {consentFile.name} (
//                 {(consentFile.size / 1024).toFixed(1)} KB)
//               </p>
//             )}
//           </div>

//           {/* Submit */}
//           <div className="flex justify-end pt-4">
//             <Button
//               type="submit"
//               disabled={
//                 loading ||
//                 !selectedDoctorId ||
//                 !campDate ||
//                 consentFile === null ||
//                 !userTerritory ||
//                 !doctorWhatsApp
//               }
//               className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-600 hover:to-green-600 text-white font-semibold px-8 py-2 rounded-lg transition-all shadow-md"
//             >
//               {loading ? "Creating..." : "Create Camp"}
//             </Button>
//           </div>
//         </CardContent>
//       </Card>
//     </form>
//   );
// });

// CreateCampInline.displayName = "CreateCampInline";

// export default CreateCampInline;