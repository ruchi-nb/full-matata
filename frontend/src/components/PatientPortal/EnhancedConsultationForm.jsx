// Enhanced Consultation Form - Auto-fetches user data from database
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientProfile, createConsultation } from '@/data/api-patient';
import { getDoctorProfile } from '@/data/api-doctor';
import { useUser } from '@/data/UserContext';
import { Calendar, Clock, User, Stethoscope, MapPin, Phone, Mail, ChevronRight, CheckCircle, AlertCircle, ArrowLeft, Globe, Mic } from 'lucide-react';
import { motion } from 'framer-motion';

const EnhancedConsultationForm = ({ doctor, onBack }) => {
  const router = useRouter();
  const { user, getUserDisplayName } = useUser();
  
  // State
  const [userDetails, setUserDetails] = useState(null);
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showLanguageSelection, setShowLanguageSelection] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedProvider, setSelectedProvider] = useState('sarvam');
  const [doctorLanguages, setDoctorLanguages] = useState([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(true);
  
  // All available language options with provider-specific groups
  const languageOptions = {
    deepgram: [
      { value: 'en', label: 'English' },
      { value: 'multi', label: 'Multi-Language (Auto-detect)' }
    ],
    sarvam: [
      { value: 'hi', label: 'Hindi' },
      { value: 'bn', label: 'Bengali' },
      { value: 'gu', label: 'Gujarati' },
      { value: 'kn', label: 'Kannada' },
      { value: 'ml', label: 'Malayalam' },
      { value: 'mr', label: 'Marathi' },
      { value: 'pa', label: 'Punjabi' },
      { value: 'ta', label: 'Tamil' },
      { value: 'te', label: 'Telugu' }
    ]
  };

  // Get doctor-specific language options based on selected provider
  const getDoctorLanguageOptions = () => {
    const providerLanguages = languageOptions[selectedProvider] || languageOptions.deepgram;
    
    if (!doctorLanguages || doctorLanguages.length === 0) {
      return providerLanguages.filter(option => option.value === 'en');
    }
    
    // Filter languages based on what the doctor supports and what the provider supports
    return providerLanguages.filter(option => 
      doctorLanguages.includes(option.value) || option.value === 'multi'
    );
  };

  // Provider options
  const providerOptions = [
    { value: 'deepgram', label: 'Deepgram AI', description: 'High accuracy, supports diarization' },
    { value: 'sarvam', label: 'Sarvam AI', description: 'Optimized for Indian languages' }
  ];

  // Fetch user details from database
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        setIsLoadingUserData(true);
        setError(null);
        
        // Fetch user details from the database using api-patient.js
        const details = await getPatientProfile();
        
        // If no details found, create minimal profile from user context
        if (!details || details.status === 404) {
          const minimalProfile = {
            first_name: user?.first_name || user?.username || getUserDisplayName().split(' ')[0],
            last_name: user?.last_name || '',
            email: user?.email || '',
            phone: user?.phone || '',
            dob: user?.dob || '',
            gender: user?.gender || '',
            address: user?.address || '',
            avatar_url: user?.avatar_url || null
          };
          setUserDetails(minimalProfile);
        } else {
          setUserDetails(details);
        }
        
      } catch (error) {
        console.error('Failed to fetch user details:', error);
        
        // Fallback to user context data
        const fallbackProfile = {
          first_name: user?.first_name || user?.username || getUserDisplayName().split(' ')[0],
          last_name: user?.last_name || '',
          email: user?.email || '',
          phone: user?.phone || '',
          dob: user?.dob || '',
          gender: user?.gender || '',
          address: user?.address || '',
          avatar_url: user?.avatar_url || null
        };
        setUserDetails(fallbackProfile);
        
        setError('Using cached profile data. Some information may be incomplete.');
      } finally {
        setIsLoadingUserData(false);
      }
    };

    if (user) {
      fetchUserDetails();
    }
  }, [user, getUserDisplayName]);

  // Fetch doctor-specific languages
  useEffect(() => {
    const fetchDoctorLanguages = async () => {
      if (!doctor?.id) return;
      
      try {
        setIsLoadingLanguages(true);
        // For now, parse languages from doctor data
        if (doctor.languages) {
          const languageMap = {
            'English': 'en', 'Hindi': 'hi', 'Bengali': 'bn', 'Gujarati': 'gu',
            'Kannada': 'kn', 'Malayalam': 'ml', 'Marathi': 'mr', 'Punjabi': 'pa',
            'Tamil': 'ta', 'Telugu': 'te',
          };
          const languages = doctor.languages
            .split(',')
            .map(lang => lang.trim())
            .map(lang => languageMap[lang] || 'en')
            .filter((value, index, self) => self.indexOf(value) === index);
          setDoctorLanguages(languages);
          
          // Set default language to first available language
          if (languages.length > 0) {
            setSelectedLanguage(languages[0]);
          }
          
          console.log(`Doctor ${doctor.name} supports languages:`, languages);
        } else {
          setDoctorLanguages(['en']);
          setSelectedLanguage('en');
          console.log(`Doctor ${doctor.name} supports languages: ['en'] (default)`);
        }
      } catch (error) {
        console.error('Failed to fetch doctor languages:', error);
        // Fallback to English
        setDoctorLanguages(['en']);
        setSelectedLanguage('en');
      } finally {
        setIsLoadingLanguages(false);
      }
    };

    fetchDoctorLanguages();
  }, [doctor]);

  // Handle provider change - reset language if current language is not supported by new provider
  useEffect(() => {
    const providerLanguages = languageOptions[selectedProvider] || languageOptions.deepgram;
    const availableLanguages = getDoctorLanguageOptions();
    
    // If current language is not available for the selected provider, switch to first available
    if (!availableLanguages.find(lang => lang.value === selectedLanguage)) {
      if (availableLanguages.length > 0) {
        setSelectedLanguage(availableLanguages[0].value);
      }
    }
  }, [selectedProvider, doctorLanguages]);

  // Handle consultation creation
  const handleCreateConsultation = async () => {
    if (!userDetails) {
      setError('User details not available. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      // Create consultation with proper API structure
      const consultationData = {
        patient_id: user?.user_id || user?.id,
        doctor_id: doctor.id,
        specialty_id: doctor.specialtyId || 1,
        hospital_id: user?.hospital_id || null,
        consultation_type: 'online'
      };

      console.log('Creating consultation with data:', consultationData);

      const result = await createConsultation(consultationData);

      console.log('Consultation created successfully:', result);

      // Navigate directly to the video call page with auto-start
      const videoCallUrl = `/conversation?consultationId=${result.consultation_id}&doctorId=${doctor.id}&language=${selectedLanguage}&provider=${selectedProvider}&autoStart=true`;
      router.push(videoCallUrl);
      
    } catch (error) {
      console.error('Consultation creation failed:', error);
      setError(`Failed to create consultation: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Get age from date of birth
  const getAge = (dob) => {
    if (!dob) return 'Not provided';
    try {
      const today = new Date();
      const birthDate = new Date(dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch {
      return 'Invalid date';
    }
  };

  if (isLoadingUserData) {
    return (
      <div className="min-h-screen bg-gray-50 py-4 md:py-8 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="text-lg text-gray-600">Loading your profile...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8 px-3 sm:px-4 md:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Doctors
            </button>
            <div className="text-sm text-gray-500">
              Consultation with Dr. {doctor?.name}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <img 
                src={doctor?.image} 
                alt={doctor?.name}
                className="w-full h-full rounded-full object-cover"
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.name)}&background=3B82F6&color=fff&size=200`;
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dr. {doctor?.name}</h1>
              <p className="text-gray-600">{doctor?.specialty}</p>
              <div className="flex items-center mt-2 text-sm text-gray-500">
                <MapPin className="w-4 h-4 mr-1" />
                <span>{doctor?.location || 'Online Consultation'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile Summary */}
        {/* <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <User className="w-5 h-5 mr-2" />
            Your Profile Information
          </h2>
          
          {error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
                <span className="text-yellow-700 text-sm">{error}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">
                    {userDetails ? `${userDetails.first_name} ${userDetails.last_name}`.trim() : 'Loading...'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <Mail className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">{userDetails?.email || 'Not provided'}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <Phone className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">{userDetails?.phone || 'Not provided'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">
                    {userDetails?.dob ? `${getAge(userDetails.dob)} years old` : 'Not provided'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900 capitalize">{userDetails?.gender || 'Not provided'}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">{formatDate(userDetails?.dob)}</span>
                </div>
              </div>
            </div>
          </div>

          {userDetails?.address && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-gray-900">{userDetails.address}</span>
              </div>
            </div>
          )}
        </div> */}

        {/* Consultation Preferences */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Stethoscope className="w-5 h-5 mr-2" />
            Consultation Preferences
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Language Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Globe className="w-4 h-4 inline mr-1" />
                Preferred Language
                {isLoadingLanguages && (
                  <span className="text-xs text-gray-500 ml-2">(Loading...)</span>
                )}
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                disabled={isLoadingLanguages}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {selectedProvider === 'deepgram' ? (
                  <>
                    <optgroup label="Deepgram Languages">
                      {languageOptions.deepgram.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  </>
                ) : (
                  <>
                    <optgroup label="Sarvam Languages">
                      {languageOptions.sarvam.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}
              </select>
              {doctorLanguages.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Dr. {doctor?.name} supports {doctorLanguages.length} language{doctorLanguages.length > 1 ? 's' : ''} • {selectedProvider === 'deepgram' ? 'English optimized' : 'Indian languages'}
                </p>
              )}
            </div>

            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mic className="w-4 h-4 inline mr-1" />
                Audio Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {providerOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {providerOptions.find(p => p.value === selectedProvider)?.description}
              </p>
            </div>
          </div>
        </div>

        {/* Consultation Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Consultation Summary</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Doctor:</span>
                <span className="font-medium">Dr. {doctor?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Specialty:</span>
                <span className="font-medium">{doctor?.specialty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Patient:</span>
                <span className="font-medium">
                  {userDetails ? `${userDetails.first_name} ${userDetails.last_name}`.trim() : 'Loading...'}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Language:</span>
                <span className="font-medium">
                  {languageOptions[selectedProvider]?.find(l => l.value === selectedLanguage)?.label || selectedLanguage}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Provider:</span>
                <span className="font-medium">{providerOptions.find(p => p.value === selectedProvider)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium">Online Consultation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel
          </button>
          
          <motion.button
            onClick={handleCreateConsultation}
            disabled={isSubmitting || !userDetails}
            className={`px-8 py-3 rounded-lg font-medium transition-colors ${
              isSubmitting || !userDetails
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            whileHover={{ scale: isSubmitting || !userDetails ? 1 : 1.02 }}
            whileTap={{ scale: isSubmitting || !userDetails ? 1 : 0.98 }}
          >
            {isSubmitting ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Consultation...
              </div>
            ) : (
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                Start Consultation
              </div>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedConsultationForm;
