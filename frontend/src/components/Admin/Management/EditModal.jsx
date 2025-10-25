"use client";

import { X } from "lucide-react";
import { useState, useEffect } from "react";

export default function EditHospitalModal({ hospital, isOpen, onClose, onUpdate }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    status: "Active",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pre-fill form when modal opens
  useEffect(() => {
    if (hospital) {
      setFormData({
        name: hospital.name || "",
        email: hospital.email || "",
        phone: hospital.phone || "",
        location: hospital.location || "",
        status: hospital.status || "Active",
      });
    }
  }, [hospital]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Call parent callback to update hospital
      await onUpdate({ ...hospital, ...formData });
      onClose();
    } catch (err) {
      console.error('Failed to update hospital:', err);
      setError(err.message || 'Failed to update hospital');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Edit Hospital</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block font-medium text-slate-700 text-sm sm:text-base mb-2">Hospital Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full text-black border rounded-md px-3 py-2 text-sm sm:text-base"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 text-sm sm:text-base mb-2">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full text-black border rounded-md px-3 py-2 text-sm sm:text-base"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 text-sm sm:text-base mb-2">Phone *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full text-black border rounded-md px-3 py-2 text-sm sm:text-base"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 text-sm sm:text-base mb-2">Location *</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full text-black border rounded-md px-3 py-2 text-sm sm:text-base"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 text-sm sm:text-base mb-2">Status *</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full text-black border rounded-md px-3 py-2 text-sm sm:text-base"
                required
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                {loading ? 'Updating...' : 'Update Hospital'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
