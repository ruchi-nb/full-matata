"use client";
import { useState, useRef } from "react";
import { Building, Upload, Save, X } from "lucide-react";

export default function Profile() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      <h2 className="text-xl font-semibold text-slate-900 mb-6">
        Hospital Profile
      </h2>

      <div className="space-y-6">
        {/* Hospital Logo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Hospital Logo
          </label>
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-stone-100 rounded-lg flex items-center justify-center overflow-hidden">
              {preview ? (
                <img
                  src={preview}
                  alt="Logo Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building className="h-8 w-8 text-slate-400" />
              )}
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 cursor-pointer text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors font-medium flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Logo</span>
            </button>
          </div>
        </div>

        {/* Hospital Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Hospital Name *
            </label>
            <input
              type="text"
              defaultValue="Metropolitan General Hospital"
              className="w-full px-4 py-2 text-gray-800 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              defaultValue="+1 (555) 123-4567"
              className="w-full px-4 py-2 text-gray-800 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium cursor-not-allowed text-slate-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              defaultValue="admin@metrohealth.com"
              className="w-full px-4 py-2 text-gray-800 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Website
            </label>
            <input
              type="url"
              defaultValue="https://www.metrohealth.com"
              className="w-full px-4 py-2 text-gray-800 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Address
          </label>
          <textarea
            rows={3}
            defaultValue="123 Medical Center Drive, New York, NY 10001"
            className="w-full px-4 py-2 text-gray-800 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button className="bg-blue-600 cursor-pointer text-white px-6 py-2 rounded-lg hover:bg-teal-700 transition-colors font-medium flex items-center space-x-2">
            <Save className="h-4 w-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40 bg-opacity-40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative">
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 text-slate-500 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Upload Hospital Logo
            </h3>

            {/* Drag & Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-stone-300 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500"
              onClick={() => fileInputRef.current?.click()}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-40 object-contain mb-3"
                />
              ) : (
                <Upload className="h-10 w-10 text-slate-400 mb-2" />
              )}
              <p className="text-sm text-slate-600">
                Drag & drop your image here, or click to browse
              </p>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end mt-6 space-x-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 cursor-pointer rounded-lg border border-stone-300 text-slate-700 hover:bg-red-100"
              >
                Cancel
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 cursor-pointer rounded-lg bg-blue-600 text-white hover:bg-teal-700"
              >
                Save Logo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
