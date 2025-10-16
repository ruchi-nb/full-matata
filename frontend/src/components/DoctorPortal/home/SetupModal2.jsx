"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import SetupLayout from "@/app/doctorportal/setup/SetupLayout";

export default function SetupModal2() {
  const router = useRouter();
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null); // New state for preview

  // Handle file input change
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setPhotoUploaded(true);

      // Generate preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPhotoUploaded(false);
      setPhotoPreview(null);
    }
  };

  const handleprev = () => {
    router.back();
  };

  const handleNext = () => {
    if (photoUploaded) {
      router.push("/doctorportal/setup/Step3"); // Navigate to next page
    }
  };

  return (
    <SetupLayout>
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-8">
            {/* ... existing progress steps code ... */}
          </div>

          {/* Content Card */}
          <div className="bg-white rounded-xl shadow-xl p-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Profile Photo
              </h2>
              <div className="text-center">
                <div className="mb-6">
                  <div className="w-32 h-32 rounded-full mx-auto bg-gray-200 flex items-center justify-center overflow-hidden">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
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
                        className="lucide lucide-camera h-10 w-10 text-gray-400"
                      >
                        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                        <circle cx="12" cy="13" r="3"></circle>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  accept="image/*"
                  id="fileInput"
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Label triggers input */}
                <label htmlFor="fileInput" className="inline-block">
                  <span className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
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
                      className="lucide lucide-upload h-4 w-4 mr-2"
                      aria-hidden="true"
                    >
                      <path d="M12 3v12"></path>
                      <path d="m17 8-5-5-5 5"></path>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    </svg>
                    Upload Photo
                  </span>
                </label>

                <p className="text-sm text-gray-500 mt-2">
                  Choose a professional photo that will represent you
                </p>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
              <button
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={handleprev}
              >
                {/* ... previous button SVG ... */}
                Previous
              </button>

              <button
                className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  photoUploaded
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-blue-600 opacity-50 cursor-not-allowed"
                }`}
                disabled={!photoUploaded}
                onClick={handleNext}
              >
                Next
                {/* ... next button SVG ... */}
              </button>
            </div>
          </div>
        </div>
      </div>
    </SetupLayout>
  );
}
