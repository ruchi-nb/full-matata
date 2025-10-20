"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onboardHospitalAdmin } from "@/data/api-superadmin";
import {
  validateEmail,
  validatePhone,
  validatePassword,
  validateHospitalName
} from "@/utils/validation";

// Utility function for random string generation
function randFrom(chars, n) {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function AddHospitalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [form, setForm] = useState({
    hospital_name: "",
    hospital_email: "",
    admin_email: "",
    admin_username: "",
    admin_password: "",
    admin_first_name: "",
    admin_last_name: "",
    admin_phone: "",
    auto_login: false,
    genMode: "pattern" // 'pattern' | 'random'
  });

  // Auto-fill username from email
  const username = useMemo(() => form.admin_email.trim(), [form.admin_email]);

  const generatePassword = () => {
    if (form.genMode === "random") {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
      const pw = randFrom(chars, 12);
      setForm((f) => ({ ...f, admin_password: pw }));
      return;
    }
    // pattern: first 2 of first name + first 2 of last name + last 4 of phone + random 2
    const f2 = (form.admin_first_name || "").replace(/\s+/g, "").slice(0, 2).toLowerCase();
    const l2 = (form.admin_last_name || "").replace(/\s+/g, "").slice(0, 2).toLowerCase();
    const last4 = (form.admin_phone || "").replace(/\D/g, "").slice(-4);
    const extra = randFrom("!@#$%abcdefghijkmnpqrstuvwxyz23456789", 2);
    const base = `${f2}${l2}${last4}${extra}`;
    setForm((f) => ({ ...f, admin_password: base || randFrom("abcdefghijkmnpqrstuvwxyz23456789", 8) }));
  };

  const validateAllFields = () => {
    const errors = {};

    // Validate hospital name
    const hospitalNameError = validateHospitalName(form.hospital_name);
    if (hospitalNameError) errors.hospital_name = hospitalNameError;

    // Validate hospital email (optional)
    if (form.hospital_email) {
      const hospitalEmailError = validateEmail(form.hospital_email);
      if (hospitalEmailError) errors.hospital_email = hospitalEmailError;
    }

    // Validate admin email (required)
    const adminEmailError = validateEmail(form.admin_email);
    if (adminEmailError) errors.admin_email = adminEmailError;

    // Validate admin password
    const passwordError = validatePassword(form.admin_password);
    if (passwordError) errors.admin_password = passwordError;

    // Validate admin phone (optional)
    if (form.admin_phone) {
      const phoneError = validatePhone(form.admin_phone);
      if (phoneError) errors.admin_phone = phoneError;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Validate all fields
    if (!validateAllFields()) {
      setError("Please fix the validation errors before submitting");
      setLoading(false);
      return;
    }

    try {

      console.log("Creating hospital with admin:", form);

      // Prepare payload for API - matches exact backend schema
      const payload = {
        hospital_name: form.hospital_name.trim(),
        hospital_email: form.hospital_email.trim() || null,
        admin_email: form.admin_email.trim(),
        admin_password: form.admin_password,
        admin_username: username || form.admin_email.split("@")[0],
        admin_first_name: form.admin_first_name.trim() || null,
        admin_last_name: form.admin_last_name.trim() || null,
        admin_phone: form.admin_phone.trim() || null,
        auto_login: form.auto_login
      };

      // Call the API to create hospital and admin
      const result = await onboardHospitalAdmin(payload);

      console.log("Hospital creation successful:", result);

      setSuccess(`Hospital "${form.hospital_name}" and admin "${form.admin_email}" created successfully! The admin now has all required permissions.`);

      // Reset form after successful submission
      setForm({
        hospital_name: "",
        hospital_email: "",
        admin_email: "",
        admin_username: "",
        admin_password: "",
        admin_first_name: "",
        admin_last_name: "",
        admin_phone: "",
        auto_login: false,
        genMode: "pattern"
      });

      // Redirect back to hospitals list after a delay
      setTimeout(() => {
        router.push('/admin/management');
      }, 3000);

    } catch (err) {
      console.error("Failed to create hospital:", err);
      setError(err.message || "Failed to create hospital. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
    
    // Clear messages when user starts typing
    if (error || success) {
      setError("");
      setSuccess("");
    }

    // Real-time validation for specific fields
    const errors = { ...validationErrors };
    
    switch (field) {
      case 'hospital_name':
        const nameError = validateHospitalName(value);
        if (nameError) {
          errors.hospital_name = nameError;
        } else {
          delete errors.hospital_name;
        }
        break;
      case 'hospital_email':
        if (value) {
          const hospitalEmailError = validateEmail(value);
          if (hospitalEmailError) {
            errors.hospital_email = hospitalEmailError;
          } else {
            delete errors.hospital_email;
          }
        } else {
          delete errors.hospital_email;
        }
        break;
      case 'admin_email':
        const adminEmailError = validateEmail(value);
        if (adminEmailError) {
          errors.admin_email = adminEmailError;
        } else {
          delete errors.admin_email;
        }
        break;
      case 'admin_password':
        const passwordError = validatePassword(value);
        if (passwordError) {
          errors.admin_password = passwordError;
        } else {
          delete errors.admin_password;
        }
        break;
      case 'admin_phone':
        if (value) {
          const phoneError = validatePhone(value);
          if (phoneError) {
            errors.admin_phone = phoneError;
          } else {
            delete errors.admin_phone;
          }
        } else {
          delete errors.admin_phone;
        }
        break;
      default:
        break;
    }
    
    setValidationErrors(errors);
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Header with back button */}
      <div className="flex items-center justify-between mb-8">
        <div >
          <h1 className="text-3xl font-bold text-slate-900">
            Add New Hospital
          </h1>
          <p className="text-slate-600 mt-2">
            Fill in the hospital and admin details to add a new hospital to the system. Username is auto-filled from email and password can be generated automatically.
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg">
          <p className="text-green-800 font-medium">✅ {success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-red-800 font-medium">❌ {error}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Hospital Information */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Hospital Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Hospital Name *
                </label>
                <input
                  type="text"
                  value={form.hospital_name}
                  onChange={handleChange('hospital_name')}
                  className={`text-gray-700 block w-full rounded-md border ${validationErrors.hospital_name ? 'border-red-500' : 'border-slate-300'} shadow-sm px-3 py-2 focus:border-teal-500 focus:ring focus:ring-teal-200`}
                  placeholder="Enter hospital name"
                  required
                />
                {validationErrors.hospital_name && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.hospital_name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Hospital Email
                </label>
                <input
                  type="email"
                  value={form.hospital_email}
                  onChange={handleChange('hospital_email')}
                  className={`text-gray-700 block w-full rounded-md border ${validationErrors.hospital_email ? 'border-red-500' : 'border-slate-300'} shadow-sm px-3 py-2 focus:border-teal-500 focus:ring focus:ring-teal-200`}
                  placeholder="Enter hospital contact email"
                />
                {validationErrors.hospital_email && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.hospital_email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Admin Personal Information */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Admin Email *
                </label>
                <input
                  type="email"
                  value={form.admin_email}
                  onChange={handleChange('admin_email')}
                  className={`text-gray-700 block w-full rounded-md border ${validationErrors.admin_email ? 'border-red-500' : 'border-slate-300'} shadow-sm px-3 py-2 focus:border-teal-500 focus:ring focus:ring-teal-200`}
                  placeholder="Enter admin email address"
                  required
                />
                {validationErrors.admin_email && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.admin_email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Admin Phone
                </label>
                <input
                  type="tel"
                  value={form.admin_phone}
                  onChange={handleChange('admin_phone')}
                  className={`text-gray-700 block w-full rounded-md border ${validationErrors.admin_phone ? 'border-red-500' : 'border-slate-300'} shadow-sm px-3 py-2 focus:border-teal-500 focus:ring focus:ring-teal-200`}
                  placeholder="Enter admin phone number"
                />
                {validationErrors.admin_phone && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.admin_phone}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={form.admin_first_name}
                  onChange={handleChange('admin_first_name')}
                  className="text-gray-700 block w-full rounded-md border border-slate-300 shadow-sm px-3 py-2 focus:border-teal-500 focus:ring focus:ring-teal-200"
                  placeholder="Enter admin first name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={form.admin_last_name}
                  onChange={handleChange('admin_last_name')}
                  className="text-gray-700 block w-full rounded-md border border-slate-300 shadow-sm px-3 py-2 focus:border-teal-500 focus:ring focus:ring-teal-200"
                  placeholder="Enter admin last name"
                />
              </div>
            </div>
          </div>

          {/* Login Credentials */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Login Credentials</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  readOnly
                  placeholder="Auto-filled from email"
                  className="text-gray-700 block w-full rounded-md border border-slate-300 shadow-sm px-3 py-2 bg-gray-50"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Password *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Click Generate or type your own"
                  value={form.admin_password}
                  onChange={handleChange('admin_password')}
                  disabled={loading}
                  className={`text-gray-700 block w-full rounded-md border ${validationErrors.admin_password ? 'border-red-500' : 'border-slate-300'} shadow-sm px-3 py-2 focus:border-teal-500 focus:ring focus:ring-teal-200 disabled:bg-gray-50 disabled:text-gray-500`}
                />
                {validationErrors.admin_password && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.admin_password}</p>
                )}
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Generation Mode
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={form.genMode}
                    onChange={handleChange('genMode')}
                    disabled={loading}
                    className="flex-1 text-gray-700 block rounded-md border border-slate-300 shadow-sm px-3 py-2 focus:border-teal-500 focus:ring focus:ring-teal-200 disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="pattern">Name+Phone Pattern</option>
                    <option value="random">Random Secure</option>
                  </select>
                  <button
                    type="button"
                    onClick={generatePassword}
                    disabled={loading}
                    className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Generate Password
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Link
              href="/admin/management" 
              className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Add Hospital"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}