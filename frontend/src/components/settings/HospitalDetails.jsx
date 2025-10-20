"use client";
import { useState, useEffect } from "react";
import { Building, Save, Phone, Mail, MapPin } from "lucide-react";
import { useUser } from "@/data/UserContext";
import { request } from "@/data/api";

export default function HospitalDetails() {
  const { user, getHospitalId } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    hospital_name: "",
    hospital_email: "",
    admin_contact: "",
    address: "",
    is_active: true,
  });

  // Load hospital profile
  useEffect(() => {
    async function loadHospitalProfile() {
      try {
        const hospitalId = getHospitalId();
        if (!hospitalId) {
          console.error("No hospital ID found");
          setLoading(false);
          return;
        }

        setLoading(true);
        console.log("🔍 Loading hospital profile for ID:", hospitalId);
        
        const profile = await request(`/hospital-admin/hospitals/${hospitalId}/profile`, { method: "GET" });
        console.log("✅ Hospital profile loaded:", profile);
        
        setFormData({
          hospital_name: profile.hospital_name || "",
          hospital_email: profile.hospital_email || "",
          admin_contact: profile.admin_contact || "",
          address: profile.address || "",
          is_active: profile.is_active !== undefined ? profile.is_active : true,
        });
      } catch (error) {
        console.error("Failed to load hospital profile:", error);
        alert(`Failed to load hospital profile: ${error.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadHospitalProfile();
    }
  }, [user, getHospitalId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const hospitalId = getHospitalId();
      console.log("💾 Updating hospital profile for ID:", hospitalId);
      
      await request(`/hospital-admin/hospitals/${hospitalId}/profile`, {
        method: "PUT",
        body: JSON.stringify({
          hospital_name: formData.hospital_name,
          hospital_email: formData.hospital_email,
          admin_contact: formData.admin_contact,
          address: formData.address,
          is_active: formData.is_active,
        }),
      });
      
      console.log("✅ Hospital profile updated successfully");
      alert("Hospital details updated successfully!");
    } catch (error) {
      console.error("Error updating hospital profile:", error);
      alert(`Failed to update hospital details: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="text-center text-gray-600">Loading hospital details...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center space-x-2">
        <Building className="h-6 w-6 text-blue-600" />
        <span>Hospital Details</span>
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hospital Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Hospital Name *
            </label>
            <input
              type="text"
              name="hospital_name"
              value={formData.hospital_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 text-gray-800 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter hospital name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center space-x-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <span>Email Address</span>
            </label>
            <input
              type="email"
              name="hospital_email"
              value={formData.hospital_email}
              onChange={handleChange}
              className="w-full px-4 py-2 text-gray-800 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="admin@hospital.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center space-x-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <span>Contact Number</span>
            </label>
            <input
              type="tel"
              name="admin_contact"
              value={formData.admin_contact}
              onChange={handleChange}
              className="w-full px-4 py-2 text-gray-800 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span>Address</span>
            </label>
            <textarea
              name="address"
              rows={3}
              value={formData.address}
              onChange={handleChange}
              className="w-full px-4 py-2 text-gray-800 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter complete hospital address"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Hospital Status
            </label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="is_active"
                  checked={formData.is_active === true}
                  onChange={() => setFormData(prev => ({ ...prev, is_active: true }))}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="is_active"
                  checked={formData.is_active === false}
                  onChange={() => setFormData(prev => ({ ...prev, is_active: false }))}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Inactive</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Inactive hospitals will not be able to use the system
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Changes to hospital details will be reflected across the entire system. Please verify all information before saving.
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 cursor-pointer text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

