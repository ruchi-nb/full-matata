"use client";
import React, { useState } from 'react';
import { X, Mic, Globe, CheckCircle } from 'lucide-react';
import InvertedGradientButton from '@/components/common/InvertedGradientButton';
import OutlineButton from '@/components/common/OutlineButton';

const ConsultationSettings = ({ isOpen, onClose, onStart, doctor }) => {
  const [provider, setProvider] = useState('deepgram');
  const [language, setLanguage] = useState('en');

  if (!isOpen) return null;

  const handleStart = () => {
    onStart({ provider, language });
  };

  const providers = [
    {
      id: 'deepgram',
      name: 'Deepgram',
      description: 'English optimized - Best for English conversations',
      icon: '🎯',
      languages: [
        { code: 'en', name: 'English' },
        { code: 'multi', name: 'Multi-Language (Auto-detect)' }
      ]
    },
    {
      id: 'sarvam',
      name: 'Sarvam',
      description: 'Indian languages - Best for Hindi, Tamil, Telugu, etc.',
      icon: '🇮🇳',
      languages: [
        { code: 'hi', name: 'Hindi (हिन्दी)' },
        { code: 'bn', name: 'Bengali (বাংলা)' },
        { code: 'gu', name: 'Gujarati (ગુજરાતી)' },
        { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
        { code: 'ml', name: 'Malayalam (മലയാളം)' },
        { code: 'mr', name: 'Marathi (मराठी)' },
        { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)' },
        { code: 'ta', name: 'Tamil (தமிழ்)' },
        { code: 'te', name: 'Telugu (తెలుగు)' }
      ]
    }
  ];

  const selectedProvider = providers.find(p => p.id === provider);
  const availableLanguages = selectedProvider?.languages || [];

  // Reset language when provider changes
  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    // Set default language for the selected provider
    if (newProvider === 'deepgram') {
      setLanguage('en');
    } else if (newProvider === 'sarvam') {
      setLanguage('hi');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2 font-poppins">
                  Start Consultation
                </h2>
                {doctor && (
                  <p className="text-gray-600 font-gothambook">
                    with Dr. {doctor.first_name} {doctor.last_name}
                    {doctor.specialties?.[0] && (
                      <span className="text-blue-600 font-semibold"> • {doctor.specialties[0].name}</span>
                    )}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-white/50 rounded-lg"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Provider Selection */}
            <div>
              <div className="flex items-center mb-3">
                <Mic className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900 font-poppins">
                  Choose Provider
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map((prov) => (
                  <button
                    key={prov.id}
                    onClick={() => handleProviderChange(prov.id)}
                    className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                      provider === prov.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    {provider === prov.id && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                      </div>
                    )}
                    <div className="text-3xl mb-2">{prov.icon}</div>
                    <div className="font-semibold text-gray-900 mb-1 font-poppins">
                      {prov.name}
                    </div>
                    <div className="text-sm text-gray-600 font-gothambook">
                      {prov.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <div className="flex items-center mb-3">
                <Globe className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900 font-poppins">
                  Choose Language
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      language === lang.code
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 font-gothambook">
                        {lang.name}
                      </span>
                      {language === lang.code && (
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center font-poppins">
                <span className="mr-2">ℹ️</span> What to expect
              </h4>
              <ul className="space-y-2 text-sm text-blue-800 font-gothambook">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Real-time voice and video conversation with AI doctor</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Automatic speech recognition and transcription</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Natural language responses with medical knowledge</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>All conversations are encrypted and logged securely</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <OutlineButton
              onClick={onClose}
              color="gray"
              size="large"
            >
              Cancel
            </OutlineButton>
            <InvertedGradientButton
              onClick={handleStart}
              className="px-6"
            >
              Start Consultation →
            </InvertedGradientButton>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConsultationSettings;

