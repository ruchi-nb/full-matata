"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import SetupLayout from "@/app/doctorportal/setup/SetupLayout";

const SetupModal1 = () => {
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zip: "",
  });

  const [errors, setErrors] = useState({});

  // Validation functions
  const isTextValid = (value) => /^[A-Za-z\s'-]+$/.test(value);
  const isPhoneValid = (value) => /^[0-9]+$/.test(value);
  const hasNoParentheses = (value) => !/[()]/.test(value);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;
    let error;

    // Real-time filtering
    if (["firstName", "lastName", "city", "state"].includes(name)) {
      newValue = value.replace(/[^A-Za-z\s'-]/g, "");
      if (!isTextValid(newValue)) {
        error = "No numbers or special characters allowed.";
      }
    }

    if (name === "phone") {
      newValue = value.replace(/[^0-9]/g, "");
      if (newValue && !isPhoneValid(newValue)) {
        error = "Phone must contain only numbers.";
      }
    }

    if (["street", "city", "state", "firstName", "lastName"].includes(name)) {
      if (!hasNoParentheses(newValue)) {
        error = "Parentheses are not allowed.";
      }
    }

    setForm((prev) => ({ ...prev, [name]: newValue }));
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  // check if all required fields are filled and valid
  const isFormComplete =
    Object.values(form).every((val) => val.trim() !== "") &&
    Object.values(errors).every((err) => !err);

  const handleNext = () => {
    if (isFormComplete) {
      router.push("/doctorportal/setup/Step2");
    }
  };

  return (
    <SetupLayout>
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Steps header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {/* Step 1 */}
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
                  className="lucide lucide-user h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <span className="ml-2 text-sm font-medium text-blue-600">
                Personal Information
              </span>
              <div className="w-16 h-0.5 mx-4 bg-gray-300"></div>
            </div>

            {/* Step 2 */}
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 bg-white border-gray-300 text-gray-400">
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
                  className="lucide lucide-camera h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                  <circle cx="12" cy="13" r="3"></circle>
                </svg>
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">
                Profile Photo
              </span>
              <div className="w-16 h-0.5 mx-4 bg-gray-300"></div>
            </div>

            {/* Step 3 */}
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 bg-white border-gray-300 text-gray-400">
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
              <span className="ml-2 text-sm font-medium text-gray-500">
                Voice Setup
              </span>
            </div>
          </div>
        </div>

          {/* Card Content */}
          <div className="bg-white rounded-xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Personal Information
            </h2>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    First Name *
                  </label>
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 text-black border rounded-lg focus:outline-none focus:ring-2 ${
                      errors.firstName ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
                    }`}
                    placeholder="Enter your first name"
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Last Name *
                  </label>
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 text-black border rounded-lg focus:outline-none focus:ring-2 ${
                      errors.lastName ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
                    }`}
                    placeholder="Enter your last name"
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Phone Number *
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 text-black border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.phone ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
                  }`}
                  placeholder="5551234567"
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                  type="email"
                  defaultValue="a@gmail.com"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be modified</p>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-gray-900">Address</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Street Address *
                  </label>
                  <input
                    name="street"
                    value={form.street}
                    onChange={handleChange}
                    className={`w-full px-3 text-black py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      errors.street ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
                    }`}
                    placeholder="123 Main Street"
                  />
                  {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* City */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      City *
                    </label>
                    <input
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      className={`w-full px-3 text-black py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        errors.city ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
                      }`}
                      placeholder="City"
                    />
                    {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      State *
                    </label>
                    <input
                      name="state"
                      value={form.state}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 text-black border rounded-lg focus:outline-none focus:ring-2 ${
                        errors.state ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"
                      }`}
                      placeholder="State"
                    />
                    {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
                  </div>

                  {/* ZIP */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      ZIP Code *
                    </label>
                    <input
                      name="zip"
                      value={form.zip}
                      onChange={handleChange}
                      className="w-full px-3 text-black py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12345"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
              <button
                disabled
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <button
                onClick={handleNext}
                disabled={!isFormComplete}
                className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  isFormComplete
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-blue-600 opacity-50 cursor-not-allowed"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </SetupLayout>
  );
};

export default SetupModal1;
