// Enhanced Consult Component - Uses EnhancedConsultationForm
"use client";
import React from 'react';
import EnhancedConsultationForm from './EnhancedConsultationForm';

const Consult = ({ doctor, onBack }) => {
  return (
    <EnhancedConsultationForm 
      doctor={doctor} 
      onBack={onBack} 
    />
  );
};

export default Consult;