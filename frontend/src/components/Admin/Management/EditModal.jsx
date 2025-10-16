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
    subscription: "",
  });

  // Pre-fill form when modal opens
  useEffect(() => {
    if (hospital) {
      setFormData({
        name: hospital.name || "",
        email: hospital.email || "",
        phone: hospital.phone || "",
        location: hospital.location || "",
        status: hospital.status || "Active",
        subscription: hospital.subscription || "",
      });
    }
  }, [hospital]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Call parent callback to update hospital
    onUpdate({ ...hospital, ...formData });
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-800">Edit Hospital</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
          <div>
            <label className="block font-medium text-slate-700">Hospital Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full text-black border rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full text-black border rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700">Phone *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full text-black border rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700">Location *</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full text-black border rounded-md px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700">Status *</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full text-black border rounded-md px-3 py-2"
              required
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700">Subscription Plan</label>
            <input
              type="text"
              name="subscription"
              value={formData.subscription}
              disabled
              className="w-full text-black border rounded-md px-3 py-2 bg-gray-100"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Update Hospital
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
