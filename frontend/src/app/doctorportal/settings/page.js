"use client";

import { useState, useRef } from "react";
import Layout from "./Layout";
import SettingsHeader from "@/components/DoctorPortal/settings/SettingHeader";
import UnifiedDoctorSettings from "@/components/DoctorPortal/settings/UnifiedDoctorSettings";

export default function SettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const settingsRef = useRef(null);

  const handleSave = () => {
    // Trigger save in UnifiedDoctorSettings component
    if (settingsRef.current && settingsRef.current.handleSave) {
      settingsRef.current.handleSave();
    }
  };

  const handleCancel = () => {
    // Trigger cancel in UnifiedDoctorSettings component
    if (settingsRef.current && settingsRef.current.handleCancel) {
      settingsRef.current.handleCancel();
    }
    setIsEditing(false);
  };

  const handleSaveSuccess = () => {
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
        ref={settingsRef}
        isEditing={isEditing}
        onSaveSuccess={handleSaveSuccess}
      />
    </Layout>
  );
}