import { useState } from "react";
import type { FormEvent } from "react";
import type { Vendor } from "../../types";
import { useUpdateVendorMutation } from "../../store/api/vendorApi";
import { Button, Modal } from "../ui";

type ApiError = { status?: number; message?: string; data?: { message?: string; code?: string } };

export default function EditVendorModal({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const [updateVendor, { isLoading: saving }] = useUpdateVendorMutation();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    company_name: vendor.company_name,
    registration_number: vendor.registration_number ?? "",
    gst_id: vendor.gst_id ?? "",
    primary_contact_name: vendor.primary_contact_name,
    primary_contact_email: vendor.primary_contact_email,
    primary_contact_phone: vendor.primary_contact_phone ?? "",
    industry_specializations: vendor.industry_specializations.join(", "),
    geographies: vendor.geographies.join(", "),
    tier: vendor.tier as string,
    is_active: vendor.is_active,
  });

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();
    setError("");
    try {
      await updateVendor({
        id: vendor.id,
        body: {
          company_name: form.company_name,
          registration_number: form.registration_number || null,
          gst_id: form.gst_id || null,
          primary_contact_name: form.primary_contact_name,
          primary_contact_email: form.primary_contact_email,
          primary_contact_phone: form.primary_contact_phone || null,
          industry_specializations: form.industry_specializations.split(",").map((s) => s.trim()).filter(Boolean),
          geographies: form.geographies.split(",").map((s) => s.trim()).filter(Boolean),
          tier: form.tier,
          is_active: form.is_active,
        },
      }).unwrap();
      onClose();
    } catch (caught) {
      const err = caught as ApiError;
      setError(err?.data?.message ?? "Failed to save changes.");
    }
  };

  const field = (label: string, key: keyof typeof form, placeholder?: string, type = "text") => (
    <div>
      <label htmlFor={`edit-vendor-${key}`} className="zh-label">
        {label}
      </label>
      <input
        id={`edit-vendor-${key}`}
        type={type}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="zh-input"
      />
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit vendor"
      size="lg"
      preventClose={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="edit-vendor-form" loading={saving} loadingText="Saving…">
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-vendor-form" onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {field("Company name", "company_name", "Staffing Agency Ltd")}
          {field("Contact name", "primary_contact_name", "Primary Contact")}
          {field("Contact email", "primary_contact_email", "contact@agency.com")}
          {field("Contact phone", "primary_contact_phone", "+91-XXXXXXXXXX")}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {field("Industry specializations", "industry_specializations", "IT staffing, healthcare")}
          {field("Geographies", "geographies", "India, UAE")}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="edit-vendor-tier" className="zh-label">
              Vendor tier
            </label>
            <select
              id="edit-vendor-tier"
              value={form.tier}
              onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
              className="zh-input"
            >
              <option value="standard">Standard</option>
              <option value="preferred">Preferred</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          {field("Registration number", "registration_number", "123456789")}
          {field("GST ID", "gst_id", "GSTIN")}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="edit-vendor-is-active"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="h-4 w-4 rounded border-line-strong accent-navy-600"
          />
          <label htmlFor="edit-vendor-is-active" className="text-sm font-medium text-ink">
            Active vendor
          </label>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-50 px-4 py-2.5 text-sm text-danger-700">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
