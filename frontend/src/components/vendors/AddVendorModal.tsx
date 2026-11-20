import { useState } from "react";
import type { FormEvent } from "react";
import { FileUp } from "lucide-react";
import { useCreateVendorMutation, useParseVendorMutation } from "../../store/api/vendorApi";
import { Button, Modal, Spinner } from "../ui";

type ApiError = { status?: number; message?: string; data?: { message?: string; code?: string } };

const EMPTY_FORM = {
  company_name: "",
  registration_number: "",
  gst_id: "",
  primary_contact_name: "",
  primary_contact_email: "",
  primary_contact_phone: "",
  industry_specializations: "",
  geographies: "",
  tier: "standard",
};

type FormKey = keyof typeof EMPTY_FORM;

/** "Add vendor" form with optional document auto-fill. Unmounting resets the form. */
export default function AddVendorModal({ onClose }: { onClose: () => void }) {
  const [vendorFile, setVendorFile] = useState<File | null>(null);
  const [vendorParseMessage, setVendorParseMessage] = useState("");
  const [vendorParseError, setVendorParseError] = useState("");
  const [vendorFormData, setVendorFormData] = useState(EMPTY_FORM);

  const [createVendor, { isLoading: formLoading }] = useCreateVendorMutation();
  const [parseVendor, { isLoading: vendorParsing }] = useParseVendorMutation();

  const set = (key: FormKey, value: string) => setVendorFormData((current) => ({ ...current, [key]: value }));

  const parseVendorFile = async (file: File) => {
    setVendorParseMessage("");
    setVendorParseError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const parsed = await parseVendor(body).unwrap();

      setVendorFormData((current) => ({
        ...current,
        company_name: (parsed.company_name as string) || current.company_name,
        primary_contact_name: (parsed.primary_contact_name as string) || current.primary_contact_name,
        primary_contact_email: (parsed.primary_contact_email as string) || current.primary_contact_email,
        primary_contact_phone: (parsed.primary_contact_phone as string) || current.primary_contact_phone,
        industry_specializations:
          (parsed.industry_specializations as string[])?.length > 0
            ? (parsed.industry_specializations as string[]).join(", ")
            : current.industry_specializations,
        geographies:
          (parsed.geographies as string[])?.length > 0 ? (parsed.geographies as string[]).join(", ") : current.geographies,
      }));

      setVendorParseMessage("Vendor document parsed successfully. Please review the data.");
    } catch (err) {
      const error = err as ApiError;
      setVendorParseError(error?.message || "Could not extract vendor data from the file.");
    }
  };

  const handleAddVendor = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setVendorParseError("");

    try {
      await createVendor({
        company_name: vendorFormData.company_name,
        registration_number: vendorFormData.registration_number,
        gst_id: vendorFormData.gst_id,
        primary_contact_name: vendorFormData.primary_contact_name,
        primary_contact_email: vendorFormData.primary_contact_email,
        primary_contact_phone: vendorFormData.primary_contact_phone,
        industry_specializations: vendorFormData.industry_specializations
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        geographies: vendorFormData.geographies
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        tier: vendorFormData.tier,
      }).unwrap();
      onClose();
    } catch (err) {
      const error = err as ApiError;
      setVendorParseError(error?.message || "Failed to create vendor. Please check the form.");
    }
  };

  const input = (label: string, key: FormKey, placeholder: string, hint?: string) => (
    <div>
      <label htmlFor={`add-vendor-${key}`} className="zh-label">
        {label}
      </label>
      <input
        id={`add-vendor-${key}`}
        type="text"
        name={key}
        value={vendorFormData[key]}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)}
        className="zh-input"
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title="Add new vendor"
      description="Upload a file to auto-extract vendor details, then confirm the form."
      size="lg"
      preventClose={formLoading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={formLoading}>
            Cancel
          </Button>
          <Button type="submit" form="add-vendor-form" loading={formLoading} loadingText="Saving…">
            Add vendor
          </Button>
        </>
      }
    >
      <form id="add-vendor-form" onSubmit={handleAddVendor} className="space-y-4">
        <div>
          <label htmlFor="add-vendor-file" className="zh-label">
            Upload vendor document
          </label>
          <label
            htmlFor="add-vendor-file"
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-3 text-sm text-ink-soft hover:border-navy-400 hover:bg-navy-50"
          >
            <FileUp size={18} className="shrink-0 text-navy-600" aria-hidden="true" />
            <span className="min-w-0 truncate">{vendorFile ? vendorFile.name : "Choose a PDF, DOC or DOCX file"}</span>
          </label>
          <input
            id="add-vendor-file"
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setVendorFile(file);
              if (file) parseVendorFile(file);
            }}
            className="sr-only"
          />
        </div>

        {vendorParsing && (
          <div role="status" className="flex items-center gap-2 rounded-lg bg-navy-50 px-4 py-3 text-sm text-navy-700">
            <Spinner size={14} /> Parsing document, please wait…
          </div>
        )}
        {vendorParseMessage && (
          <div role="status" className="rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700">
            {vendorParseMessage}
          </div>
        )}
        {vendorParseError && (
          <div role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {vendorParseError}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {input("Company name", "company_name", "Staffing Agency Ltd")}
          {input("Contact name", "primary_contact_name", "Primary Contact")}
          {input("Contact email", "primary_contact_email", "contact@agency.com")}
          {input("Contact phone", "primary_contact_phone", "+91-XXXXXXXXXX")}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {input(
            "Industry specializations",
            "industry_specializations",
            "e.g. IT staffing, healthcare, finance",
            "Comma-separated values are supported.",
          )}
          {input("Geographies", "geographies", "e.g. India, UAE")}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="add-vendor-tier" className="zh-label">
              Vendor tier
            </label>
            <select
              id="add-vendor-tier"
              value={vendorFormData.tier}
              onChange={(e) => set("tier", e.target.value)}
              className="zh-input"
            >
              <option value="standard">Standard</option>
              <option value="preferred">Preferred</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          {input("Registration number", "registration_number", "123456789")}
          {input("GST ID", "gst_id", "GSTIN")}
        </div>
      </form>
    </Modal>
  );
}
