'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getDoctorProfile, updateDoctorProfile } from '@/data/api-doctor';
import InvertedGradientButton from '@/components/common/InvertedGradientButton';
import { 
  Camera, 
  User, 
  Mic, 
  Star, 
  Plus, 
  Play, 
  Trash2, 
  Upload, 
} from 'lucide-react';

const UnifiedDoctorSettings = ({ isEditing, onSave, onCancel }) => {
  // Profile Information State
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: 'Prefer not to say',
    pronouns: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    avatar: null,
    avatarUrl: null
  });

  // Voice Samples State
  const [voiceSamples, setVoiceSamples] = useState([]);
  const [showAddVoiceForm, setShowAddVoiceForm] = useState(false);
  const [newVoiceData, setNewVoiceData] = useState({
    name: '',
    language: 'en-US',
    audioFile: null
  });

  // UI State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // File input refs
  const avatarInputRef = useRef(null);
  const audioInputRef = useRef(null);

  // Load doctor profile data on component mount
  useEffect(() => {
    loadDoctorProfile();
    
    // Cleanup function to revoke object URLs
    return () => {
      if (profileData.avatarUrl && profileData.avatarUrl.startsWith('blob:')) {
        URL.revokeObjectURL(profileData.avatarUrl);
      }
    };
  }, []);

  const loadDoctorProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const profile = await getDoctorProfile();
      
      // Auto-fill all profile fields from backend
      setProfileData({
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        gender: profile.gender || 'Prefer not to say',
        pronouns: profile.pronouns || '',
        street: profile.street || '',
        city: profile.city || '',
        state: profile.state || '',
        zip: profile.zip || '',
        avatar: profile.avatar,
        avatarUrl: profile.avatar_url || profile.avatar
      });

      // Load voice samples if available
      if (profile.voice_samples) {
        setVoiceSamples(profile.voice_samples);
      }

    } catch (error) {
      console.error('Failed to load doctor profile:', error);
      setError('Failed to load profile data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAvatarUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file.');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB.');
        return;
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      
      setProfileData(prev => ({
        ...prev,
        avatar: file,
        avatarUrl: previewUrl
      }));
    }
  };

  const handleAudioUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('audio/')) {
        setError('Please select a valid audio file.');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Audio file size must be less than 10MB.');
        return;
      }

      setNewVoiceData(prev => ({
        ...prev,
        audioFile: file
      }));
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Validate required fields
      if (!profileData.firstName.trim() || !profileData.lastName.trim()) {
        setError('First name and last name are required.');
        return;
      }

      // Prepare form data for file uploads
      const formData = new FormData();
      
      // Add profile fields
      formData.append('first_name', profileData.firstName.trim());
      formData.append('last_name', profileData.lastName.trim());
      formData.append('phone', profileData.phone.trim());
      formData.append('gender', profileData.gender);
      formData.append('pronouns', profileData.pronouns.trim());
      formData.append('street', profileData.street.trim());
      formData.append('city', profileData.city.trim());
      formData.append('state', profileData.state.trim());
      formData.append('zip', profileData.zip.trim());

      // Add avatar if uploaded
      if (profileData.avatar) {
        formData.append('avatar', profileData.avatar);
      }

      // Update profile
      await updateDoctorProfile(formData);
      
      setSuccess('Profile updated successfully!');
      onSave && onSave();
      
      // Reload profile to get updated data
      setTimeout(() => {
        loadDoctorProfile();
      }, 1000);

    } catch (error) {
      console.error('Failed to update profile:', error);
      const errorMessage = error.message || 'Failed to update profile. Please try again.';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleAddVoiceSample = () => {
    if (!newVoiceData.name || !newVoiceData.audioFile) {
      setError('Please fill in all required fields for voice sample.');
      return;
    }

    const newSample = {
      id: Date.now().toString(),
      name: newVoiceData.name,
      language: newVoiceData.language,
      audioFile: newVoiceData.audioFile,
      isPrimary: voiceSamples.length === 0
    };

    setVoiceSamples(prev => [...prev, newSample]);
    setNewVoiceData({ name: '', language: 'en-US', audioFile: null });
    setShowAddVoiceForm(false);
    
    // Reset file input
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const handleDeleteVoiceSample = (id) => {
    setVoiceSamples(prev => prev.filter(sample => sample.id !== id));
  };

  const handleSetPrimaryVoice = (id) => {
    setVoiceSamples(prev => 
      prev.map(sample => ({
        ...sample,
        isPrimary: sample.id === id
      }))
    );
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="opacity-50">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="h-20 bg-gray-200 rounded mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Profile Information Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Profile Information</h2>
        
        {/* Avatar Section */}
        <div className="flex items-center space-x-6 mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              {profileData.avatarUrl ? (
                <img 
                  src={profileData.avatarUrl} 
                  alt="Profile Avatar" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="h-8 w-8 text-gray-400" />
              )}
            </div>
            {isEditing && (
              <button 
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-blue-600 text-white p-1 rounded-full hover:bg-blue-700"
              >
                <Camera className="h-4 w-4" />
              </button>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Dr. {profileData.firstName} {profileData.lastName}
            </h3>
            <p className="text-gray-600">{profileData.email}</p>
          </div>
        </div>

        {/* Profile Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
            <input
              value={profileData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              disabled={!isEditing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              type="text"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
            <input
              value={profileData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              disabled={!isEditing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              type="text"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input
              disabled
              value={profileData.email}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
              type="email"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be modified</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
              value={profileData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              disabled={!isEditing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              type="tel"
            />
          </div>
        </div>
      </div>

      {/* Gender Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Gender</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
            <select
              value={profileData.gender}
              onChange={(e) => handleInputChange('gender', e.target.value)}
              disabled={!isEditing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Prefer not to say">Prefer not to say</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pronouns (optional)</label>
            <input
              value={profileData.pronouns}
              onChange={(e) => handleInputChange('pronouns', e.target.value)}
              disabled={!isEditing}
              placeholder="e.g., she/her, he/him, they/them"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              type="text"
            />
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          This information helps patients address you correctly and improves communication.
        </p>
      </div>

      {/* Address Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Address Information</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
            <input
              value={profileData.street}
              onChange={(e) => handleInputChange('street', e.target.value)}
              disabled={!isEditing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              type="text"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              value={profileData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              disabled={!isEditing}
              placeholder="City"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              type="text"
            />
            <input
              value={profileData.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              disabled={!isEditing}
              placeholder="State"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              type="text"
            />
            <input
              value={profileData.zip}
              onChange={(e) => handleInputChange('zip', e.target.value)}
              disabled={!isEditing}
              placeholder="ZIP Code"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              type="text"
            />
          </div>
        </div>
      </div>

      {/* Voice Samples Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl flex items-center gap-2 font-semibold text-gray-900">
            <Mic className="w-6 h-6 text-black" />
            Voice Samples
          </h2>
          {isEditing && (
            <InvertedGradientButton
              onClick={() => setShowAddVoiceForm(true)}
              color="blue"
            >
              <Plus className="w-6 h-6 text-blue" />
              Add Voice
            </InvertedGradientButton>
          )}
        </div>

        <div className="space-y-4 mb-6">
          {voiceSamples.map((sample) => (
            <div key={sample.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {sample.isPrimary && (
                      <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                    )}
                    <h3 className="font-medium text-gray-900">{sample.name}</h3>
                  </div>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                    {sample.language}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <InvertedGradientButton color="green">
                    <Play className="w-6 h-6 text-green" />
                    Play
                  </InvertedGradientButton>
                  {!sample.isPrimary && isEditing && (
                    <InvertedGradientButton
                      onClick={() => handleSetPrimaryVoice(sample.id)}
                      color="amber"
                    >
                      Set Primary
                    </InvertedGradientButton>
                  )}
                  {isEditing && (
                    <InvertedGradientButton
                      onClick={() => handleDeleteVoiceSample(sample.id)}
                      color="red"
                    >
                      <Trash2 className="w-6 h-6 text-red" />
                      Delete
                    </InvertedGradientButton>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Voice Form */}
        {showAddVoiceForm && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Add New Voice Sample
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice Name *
                </label>
                <input
                  value={newVoiceData.name}
                  onChange={(e) => setNewVoiceData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Primary Voice, Meeting Voice"
                  type="text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language *
                </label>
                <select 
                  value={newVoiceData.language}
                  onChange={(e) => setNewVoiceData(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice Sample *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Mic className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <div className="space-x-2">
                    <button 
                      onClick={() => audioInputRef.current?.click()}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Audio
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Upload a voice sample for recognition
                  </p>
                  <input
                    ref={audioInputRef}
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="hidden"
                    type="file"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddVoiceForm(false);
                    setNewVoiceData({ name: '', language: 'en-US', audioFile: null });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddVoiceSample}
                  disabled={!newVoiceData.name || !newVoiceData.audioFile}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Voice
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedDoctorSettings;
