// File: components/PatientPortal/Settings.jsx
"use client";
import { useEffect, useState } from "react";
import { getPatientProfile, updatePatientProfile, uploadPatientAvatar } from "@/data/api-patient";
import { useUser } from '@/data/UserContext';
import { Save, MapPin, Mail, User, Image } from "lucide-react";
import InvertedGradientButton from "../common/InvertedGradientButton";

export default function ProfileForm() {
  const { user, updateUser } = useUser();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    dob: "",
    gender: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zip: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Helper function to parse address
  const parseAddressString = (addr) => {
    if (!addr || typeof addr !== "string") {
      return { street: "", city: "", state: "", zip: "" };
    }
    const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
    const street = parts[0] || "";
    const city = parts[1] || "";
    const stateZip = parts.slice(2).join(" ") || "";
    let state = "";
    let zip = "";
    if (stateZip) {
      const m = stateZip.match(/^(.*?)(\s+\d[\d-]*)?$/);
      state = (m && m[1] ? m[1].trim() : stateZip).trim();
      zip = (m && m[2] ? m[2].trim() : "");
    }
    return { street, city, state, zip };
  };

  // Helper function to normalize phone number
  const normalizePhoneNumber = (phone) => {
    if (!phone) return "";
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "");
    
    // If phone already starts with +91, return as is
    if (phone.startsWith("+91")) {
      return phone;
    }
    
    // If phone starts with 91 (without +), add the +
    if (digits.startsWith("91") && digits.length === 12) {
      return "+" + digits;
    }
    
    // If it's a 10-digit number (most common Indian format)
    if (digits.length === 10) {
      return "+91" + digits;
    }
    
    // If it starts with 0 followed by 10 digits (like 09876543210)
    if (digits.startsWith("0") && digits.length === 11) {
      return "+91" + digits.slice(1);
    }
    
    // For any other format, return the original but ensure +91 prefix for Indian numbers
    // This handles cases where user might have entered with country code differently
    if (digits.length >= 10) {
      const last10Digits = digits.slice(-10);
      return "+91" + last10Digits;
    }
    
    // If we can't normalize properly, return original
    return phone;
  };

  useEffect(() => {
    let mounted = true;
    
    (async () => {
      try {
        const data = await getPatientProfile();
        if (!mounted) return;
        const addr = parseAddressString(data.address);
        setFormData({
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          email: data.email || "",
          dob: data.dob || "",
          gender: data.gender || "",
          phone: data.phone || "",
          street: addr.street,
          city: addr.city,
          state: addr.state,
          zip: addr.zip,
        });
        setAvatarUrl(data.avatar_url || "");
        // Update the global user context
        updateUser(data);
      } catch (e) {
        if (mounted) setError(e?.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  },[]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      // Normalize phone number to ensure +91 prefix
      const normalizedPhone = normalizePhoneNumber(formData.phone);

      const addressString = [
        formData.street,
        formData.city,
        [formData.state, formData.zip].filter(Boolean).join(" ")
      ].filter(Boolean).join(", ");
      
      const updatedProfile = await updatePatientProfile({
        first_name: formData.firstName,
        last_name: formData.lastName,
        dob: formData.dob,
        gender: formData.gender,
        phone: normalizedPhone,
        address: addressString,
      });
      
      // Update the global user context with new data
      updateUser(updatedProfile);
      
      // Keep local form synced with response - re-parse address from updated profile
      const addr = parseAddressString(updatedProfile.address);
      setFormData({
        firstName: updatedProfile.first_name || "",
        lastName: updatedProfile.last_name || "",
        email: updatedProfile.email || "",
        dob: updatedProfile.dob || "",
        gender: updatedProfile.gender || "",
        phone: updatedProfile.phone || "",
        street: addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
      });
      setAvatarUrl(updatedProfile.avatar_url || avatarUrl);
    } catch (e) {
      setError(e?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mt-16 rounded-2xl mb-8 bg-gradient-to-r from-[#004dd6] to-[#3d85c6] hover:from-[#003cb3]  ">
          <h1 className="text-3xl font-bold bg-clip-text ml-4 px-6 pt-6 text-transparent bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] mb-2">Profile Settings</h1>
          <p className="ml-4 px-6 pb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] ">
            Update your personal information and preferences
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] flex items-center space-x-2">
              <Image className="w-6 h-6 text-[#f59e0b]"/>
              <span>Profile Picture</span>
            </h2>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-4">
              <img src={avatarUrl || "/images/man.png"} alt="Avatar" className="w-20 h-20 rounded-full object-cover border" />
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;
                    setAvatarUploading(true);
                    try {
                      const res = await uploadPatientAvatar(file);
                      if (res?.avatar_url) {
                        setAvatarUrl(res.avatar_url);
                        // reflect in global user
                        updateUser({ ...(user || {}), avatar_url: res.avatar_url });
                      }
                    } catch (err) {
                      setError(err?.message || "Failed to upload avatar");
                    } finally {
                      setAvatarUploading(false);
                    }
                  }}
                  className="block text-sm text-gray-700"
                />
                {avatarUploading && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
              </div>
            </div>
          </div>
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] flex items-center space-x-2">
              <User className="w-6 h-6 text-[#f59e0b]"/>
              <span>Personal Information</span>
            </h2>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <input
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Enter your first name"
                  className="w-full text-black border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Enter your last name"
                  className="w-full text-black border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium bg-clip-text text-transparent bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] mb-2 flex items-center space-x-2">
                <Mail className="w-6 h-6 text-[#f59e0b]"/>
                <span>Email Address</span>
              </label>
              <input
                name="email"
                type="email"
                value={formData.email}
                disabled
                className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Email address cannot be changed as it's used for account identification
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth
                </label>
                <input
                  name="dob"
                  type="date"
                  value={formData.dob}
                  onChange={handleChange}
                  className="w-full text-black border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full cursor-pointer text-black border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Enter your phone number"
                  className="w-full text-black border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format: +91XXXXXXXXXX or 10-digit number
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium bg-clip-text text-transparent bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] mb-4 flex items-center space-x-2">
                <MapPin className="w-6 h-6 text-[#f59e0b]"/>
                <span>Home Address</span>
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address
                  </label>
                  <input
                    name="street"
                    type="text"
                    value={formData.street}
                    onChange={handleChange}
                    placeholder="Enter your street address"
                    className="w-full text-black border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      name="city"
                      type="text"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="City"
                      className="w-full text-black border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      name="state"
                      type="text"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="State"
                      className="w-full text-black border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code
                    </label>
                    <input
                      name="zip"
                      type="text"
                      value={formData.zip}
                      onChange={handleChange}
                      placeholder="ZIP Code"
                      className="w-full text-black border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end">
              <InvertedGradientButton
                type="submit"
                color="amber"
                className=" cursor-pointer"
              >
                <Save className="w-6 h-6"/>
                <span>Save Changes</span>
              </InvertedGradientButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}