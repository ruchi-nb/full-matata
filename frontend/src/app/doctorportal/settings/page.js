"use client";

import { useState } from "react";
import Layout from "./Layout";
import SettingsHeader from "@/components/DoctorPortal/settings/SettingHeader";
import UnifiedDoctorSettings from "@/components/DoctorPortal/settings/UnifiedDoctorSettings";

export default function SettingsPage() {
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    // The save logic is now handled within UnifiedDoctorSettings
    console.log("Profile saved successfully");
    setIsEditing(false);
  };

  const handleCancel = () => {
    // The cancel logic is now handled within UnifiedDoctorSettings
    console.log("Canceling edits...");
    setIsEditing(false);
  };

  return (
    <Layout>
      <SettingsHeader 
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        onSave={handleSave}
        onCancel={handleCancel}
      />
      <UnifiedDoctorSettings 
        isEditing={isEditing}
      />
    </Layout>
  );
}