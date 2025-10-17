"use client";

import { Shield, Key, Globe } from "lucide-react";

export default function SecuritySettings() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        Security Settings
      </h3>

      <div className="space-y-4">
        {/* Two-Factor Authentication */}
        <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg border border-stone-200">
          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-stone-600" aria-hidden="true" />
            <div>
              <p className="font-medium text-stone-900">Two-Factor Authentication</p>
              <p className="text-sm text-stone-700">
                Enhanced security for admin accounts
              </p>
            </div>
          </div>
          <button className="bg-slate-600 cursor-pointer text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors font-medium">
            Configure
          </button>
        </div>

        {/* Password Policy */}
        <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg border border-stone-200">
          <div className="flex items-center space-x-3">
            <Key className="h-5 w-5 text-slate-600" aria-hidden="true" />
            <div>
              <p className="font-medium text-slate-900">Password Policy</p>
              <p className="text-sm text-slate-700">
                Minimum 8 characters, mixed case, numbers
              </p>
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
            Active
          </span>
        </div>

        {/* Single Sign-On */}
        <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg border border-stone-200">
          <div className="flex items-center space-x-3">
            <Globe className="h-5 w-5 text-slate-600" aria-hidden="true" />
            <div>
              <p className="font-medium text-slate-900">Single Sign-On (SSO)</p>
              <p className="text-sm text-slate-700">
                Connect with your hospital&apos;s identity provider
              </p>
            </div>
          </div>
          <button className="bg-slate-600 cursor-pointer text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors font-medium">
            Setup SSO
          </button>
        </div>
      </div>
    </div>
  );
}
