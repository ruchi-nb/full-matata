"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SetupLayout from "@/app/doctorportal/setup/SetupLayout";

export default function SetupModal3() {
  const router = useRouter();

  // Form state
  const [voiceName, setVoiceName] = useState("Primary Voice");
  const [language, setLanguage] = useState("en-US");
  const [voiceSample, setVoiceSample] = useState(null);
  const [promptText, setPromptText] = useState(
    "Please read the following sentence clearly."
  );

  // Dynamic prompts for each language
  const languagePrompts = {
    "en-US": "Please read this sentence in English: 'The quick brown fox jumps over the lazy dog.'",
    "en-GB": "कृपया यह वाक्य पढ़ें: 'सत्यता सबसे बड़ा गुण है।'",
    "es-ES": "Por favor, lea esta frase en Marathi: 'संपूर्ण दिवस आनंदाने भरा.'",
    "fr-FR": "Veuillez lire cette phrase en Gujarati : 'સત્યતા સર્વોત્તમ ગુણ છે.'",
    "de-DE": "దయచేసి ఈ వాక్యం తెలుగులో చదవండి: 'నిరంతర ప్రయత్నం విజయానికి మార్గం.'",
  };

  // Check if all fields are filled
  const isFormComplete = () => {
    return voiceName.trim() !== "" && language !== "" && voiceSample;
  };

  // Handlers
  const handleVoiceSample = (e) => {
    if (e.target.files && e.target.files[0]) {
      setVoiceSample(e.target.files[0]);
    }
  };

  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
    setPromptText(languagePrompts[e.target.value] || "Please read the following sentence clearly.");
  };

  const handlePrev = () => {
    router.back();
  };

  const handleNext = () => {
    if (isFormComplete()) {
      router.push("/doctorportal");
    }
  };

  return (
    <SetupLayout>
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Progress Steps (unchanged) */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {/* Step 1 */}
              <div className="flex items-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 bg-green-500 border-green-500 text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-check h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5"></path>
                  </svg>
                </div>
                <span className="ml-2 text-sm font-medium text-green-600">
                  Personal Information
                </span>
                <div className="w-16 h-0.5 mx-4 bg-green-500"></div>
              </div>

              {/* Step 2 */}
              <div className="flex items-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 bg-green-500 border-green-500 text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-check h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5"></path>
                  </svg>
                </div>
                <span className="ml-2 text-sm font-medium text-green-600">
                  Profile Photo
                </span>
                <div className="w-16 h-0.5 mx-4 bg-green-500"></div>
              </div>

              {/* Step 3 */}
              <div className="flex items-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 bg-blue-600 border-blue-600 text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-mic h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="M12 19v3"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <rect x="9" y="2" width="6" height="13" rx="3"></rect>
                  </svg>
                </div>
                <span className="ml-2 text-sm font-medium text-blue-600">
                  Voice Setup
                </span>
              </div>
            </div>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-xl shadow-xl p-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Avatar Voice Setup
              </h2>
              <div className="space-y-6">
                {/* Voice Name */}
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    htmlFor="voiceName"
                  >
                    Voice Name
                  </label>
                  <input
                    id="voiceName"
                    type="text"
                    className="w-full px-3 py-2 text-gray-500 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Primary Voice"
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                  />
                </div>

                {/* Language */}
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    htmlFor="language"
                  >
                    Language *
                  </label>
                  <select
                    id="language"
                    className="w-full px-3 py-2 text-gray-500 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={language}
                    onChange={handleLanguageChange}
                  >
                    <option value="">Select a language</option>
                    <option value="en-US">English</option>
                    <option value="en-GB">Hindi</option>
                    <option value="es-ES">Marathi</option>
                    <option value="fr-FR">Gujarati</option>
                    <option value="de-DE">Telugu</option>
                  </select>
                </div>

                {/* Voice Sample */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voice Sample *
                  </label>
                  <p className="mb-2 text-sm text-gray-600">{promptText}</p>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleVoiceSample}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:border file:rounded-lg file:border-gray-300 file:text-sm file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                  />
                  {voiceSample && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-700 mb-1">Preview your recording:</p>
                      <audio controls src={URL.createObjectURL(voiceSample)} className="w-full" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
              <button
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={handlePrev}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-arrow-left h-4 w-4 mr-2"
                  aria-hidden="true"
                >
                  <path d="m12 19-7-7 7-7"></path>
                  <path d="M19 12H5"></path>
                </svg>
                Previous
              </button>

              <button
                onClick={handleNext}
                disabled={!isFormComplete()}
                className={`inline-flex items-center px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  isFormComplete()
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-green-600 opacity-50 cursor-not-allowed"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-check h-4 w-4 mr-2"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5"></path>
                </svg>
                Finish Setup
              </button>
            </div>
          </div>
        </div>
      </div>
    </SetupLayout>
  );
}
