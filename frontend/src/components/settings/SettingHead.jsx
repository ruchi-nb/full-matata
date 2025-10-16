'use client';
import { Settings } from "lucide-react";

export default function SettingsHead() {
  return (
    <div className="mb-8 flex items-start gap-3">
      <Settings className="w-8 h-8 text-slate-700 mt-1" />
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Hospital Settings</h1>
        <p className="text-slate-600 mt-2">
          Manage your hospital profile, users, and platform configuration
        </p>
      </div>
    </div>
  );
}
