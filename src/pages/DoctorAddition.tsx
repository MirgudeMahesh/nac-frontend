import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Type for the doctor form data (matches your doctors table)
interface DoctorFormData {
  imacx_code: string;
  name: string;
  specialty: string | null;
  clinic_name: string | null;
  clinic_address: string | null;
  city: string | null;
  phone: string;
  whatsapp_number: string | null;
  Territory: string | null;
  "Employee Code": string | null;
}

interface DoctorAdditionProps {
  onSuccess?: () => void;
}

export function DoctorAddition({ onSuccess }: DoctorAdditionProps) {
  const { toast } = useToast();

  const [formData, setFormData] = useState<DoctorFormData>({
    imacx_code: "",
    name: "",
    specialty: null,
    clinic_name: null,
    clinic_address: null,
    city: null,
    phone: "",
    whatsapp_number: null,
    Territory: null,
    "Employee Code": null,
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === "" ? null : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.imacx_code.trim()) {
      toast({
        title: "Error",
        description: "IMACX Code is required.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Doctor name is required.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.phone.trim()) {
      toast({
        title: "Error",
        description: "Phone number is required.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("doctors")
        .insert([formData]);

      if (error) {
        console.error("Error inserting doctor:", error);
        toast({
          title: "Error",
          description: `Failed to add doctor: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Doctor added successfully!",
      });

      // Reset form
      setFormData({
        imacx_code: "",
        name: "",
        specialty: null,
        clinic_name: null,
        clinic_address: null,
        city: null,
        phone: "",
        whatsapp_number: null,
        Territory: null,
        "Employee Code": null,
      });

      // Call onSuccess if provided (e.g., close modal, refresh list)
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Doctor</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* IMACX Code */}
          <div className="space-y-2">
            <Label htmlFor="imacx_code">IMACX Code *</Label>
            <Input
              id="imacx_code"
              name="imacx_code"
              value={formData.imacx_code}
              onChange={handleChange}
              placeholder="Enter IMACX code"
              required
            />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Doctor Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter doctor name"
              required
            />
          </div>

          {/* Specialty */}
          <div className="space-y-2">
            <Label htmlFor="specialty">Specialty</Label>
            <Input
              id="specialty"
              name="specialty"
              value={formData.specialty ?? ""}
              onChange={handleChange}
              placeholder="Enter specialty (e.g., Cardiology)"
            />
          </div>

          {/* Clinic Name */}
          <div className="space-y-2">
            <Label htmlFor="clinic_name">Clinic Name</Label>
            <Input
              id="clinic_name"
              name="clinic_name"
              value={formData.clinic_name ?? ""}
              onChange={handleChange}
              placeholder="Enter clinic name"
            />
          </div>

          {/* Clinic Address */}
          <div className="space-y-2">
            <Label htmlFor="clinic_address">Clinic Address</Label>
            <Input
              id="clinic_address"
              name="clinic_address"
              value={formData.clinic_address ?? ""}
              onChange={handleChange}
              placeholder="Enter clinic address"
            />
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              name="city"
              value={formData.city ?? ""}
              onChange={handleChange}
              placeholder="Enter city"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter phone number"
              required
            />
          </div>

          {/* WhatsApp Number */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
            <Input
              id="whatsapp_number"
              name="whatsapp_number"
              type="tel"
              value={formData.whatsapp_number ?? ""}
              onChange={handleChange}
              placeholder="Enter WhatsApp number"
            />
          </div>

          {/* Territory */}
          <div className="space-y-2">
            <Label htmlFor="Territory">Territory(all caps)</Label>
            <Input
              id="Territory"
              name="Territory"
              value={formData.Territory ?? ""}
              onChange={handleChange}
              placeholder="Enter territory"
            />
          </div>

          {/* Employee Code */}
          <div className="space-y-2">
            <Label htmlFor="Employee Code">Employee Code</Label>
            <Input
              id="Employee Code"
              name="Employee Code"
              value={formData["Employee Code"] ?? ""}
              onChange={handleChange}
              placeholder="Enter employee code"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Doctor"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
