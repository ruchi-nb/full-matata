'use client';

import React, { useState, useEffect } from "react";
import { X, Save, Eye, EyeOff } from "lucide-react";
import { getDoctorProfile, updateDoctorProfile } from "@/data/api-doctor.js";
import { getDoctorSpecialties, setDoctorSpecialties } from "@/data/api-doctor.js";

const DoctorViewModal = ({ user, isOpen, onClose, onEdit }) => {
  const [doctorData, setDoctorData] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [availableSpecialties, setAvailableSpecialties] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    languages: [],
    specialty_ids: []
  });

  // Hardcoded specialties (as per your previous request)
  const hardcodedSpecialties = [
    { specialty_id: 1, name: "Cardiology", description: "Heart and cardiovascular health" },
    { specialty_id: 2, name: "Dermatology", description: "Skin, hair, and nail care" },
    { specialty_id: 3, name: "General Medicine", description: "Primary healthcare and wellness" },
    { specialty_id: 4, name: "Pediatrics", description: "Healthcare for children and adolescents" },
    { specialty_id: 5, name: "Orthopedics", description: "Bone, joint, and muscle care" },
    { specialty_id: 6, name: "Neurology", description: "Brain and nervous system care" },
    { specialty_id: 7, name: "Oncology", description: "Cancer diagnosis and treatment" },
    { specialty_id: 8, name: "Psychiatry", description: "Mental health and behavioral disorders" },
  ];

  // Hardcoded languages
  const availableLanguages = [
    "English", "Spanish", "French", "German", "Italian", "Portuguese", 
    "Chinese", "Japanese", "Korean", "Arabic", "Hindi", "Russian"
  ];

  useEffect(() => {
    if (isOpen && user) {
      loadDoctorData();
    }
  }, [isOpen, user]);

  const loadDoctorData = async () => {
    try {
      setLoading(true);
      
      // Load doctor profile
      const profile = await getDoctorProfile();
      console.log("Doctor profile:", profile);
      
      // Load doctor specialties
      const doctorSpecialties = await getDoctorSpecialties();
      console.log("Doctor specialties:", doctorSpecialties);
      
      setDoctorData(profile);
      setSpecialties(doctorSpecialties || []);
      setAvailableSpecialties(hardcodedSpecialties);
      
      // Set form data
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || user.email || '',
        phone: profile.phone || '',
        password: '', // Don't load password
        languages: profile.languages || [],
        specialty_ids: doctorSpecialties?.map(s => s.specialty_id) || []
      });
      
    } catch (error) {
      console.error("Failed to load doctor data:", error);
      // Fallback to user data if profile fails
      setDoctorData(user);
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        password: '',
        languages: [],
        specialty_ids: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLanguageToggle = (language) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(language)
        ? prev.languages.filter(l => l !== language)
        : [...prev.languages, language]
    }));
  };

  const handleSpecialtyToggle = (specialtyId) => {
    setFormData(prev => ({
      ...prev,
      specialty_ids: prev.specialty_ids.includes(specialtyId)
        ? prev.specialty_ids.filter(id => id !== specialtyId)
        : [...prev.specialty_ids, specialtyId]
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Update doctor profile
      const updateData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        languages: formData.languages
      };
      
      // Only include password if it's not empty
      if (formData.password) {
        updateData.password = formData.password;
      }
      
      await updateDoctorProfile(updateData);
      
      // Update specialties
      await setDoctorSpecialties(formData.specialty_ids);
      
      // Reload data
      await loadDoctorData();
      
      setIsEditing(false);
      onEdit?.();
      
    } catch (error) {
      console.error("Failed to save doctor data:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data to original values
    if (doctorData) {
      setFormData({
        first_name: doctorData.first_name || '',
        last_name: doctorData.last_name || '',
        email: doctorData.email || user.email || '',
        phone: doctorData.phone || '',
        password: '',
        languages: doctorData.languages || [],
        specialty_ids: specialties?.map(s => s.specialty_id) || []
      });
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Doctor Details' : 'Doctor Details'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      disabled={true}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {user.hospital_role?.role_name || user.global_role?.role_name || 'Unknown'}
                      </span>
                      {user.hospital_role?.description && (
                        <p className="text-xs text-gray-500 mt-1">{user.hospital_role.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Password */}
                  {isEditing && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        New Password (leave blank to keep current)
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Languages */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Languages</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {availableLanguages.map((language) => (
                    <label key={language} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.languages.includes(language)}
                        onChange={() => handleLanguageToggle(language)}
                        disabled={!isEditing}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-sm text-gray-700">{language}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Specialties */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Specialties</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableSpecialties.map((specialty) => (
                    <label key={specialty.specialty_id} className="flex items-start space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.specialty_ids.includes(specialty.specialty_id)}
                        onChange={() => handleSpecialtyToggle(specialty.specialty_id)}
                        disabled={!isEditing}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{specialty.name}</div>
                        <div className="text-sm text-gray-500">{specialty.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          
          {isEditing ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorViewModal;
