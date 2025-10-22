"use client";
import React from "react";
import { jsPDF } from "jspdf";
import { User, Calendar, Clock, File, Download } from "lucide-react";
import GradientButton from "@/components/common/GradientButton";
import InvertedGradientButton from "@/components/common/InvertedGradientButton";

const PatientCard = ({
  name,
  specialty,
  reason,
  date,
  time,
  transcriptCount,
  transcripts,
  onViewTranscript,
}) => {
  const handleDownloadPdf = () => {
    if (!transcripts || transcripts.length === 0) return;

    const doc = new jsPDF();
    let y = 10;

    doc.setFontSize(16);
    doc.text("Consultation Transcript", 10, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`Patient: ${name}`, 10, y);
    y += 6;
    doc.text(`Specialty: ${specialty}`, 10, y);
    y += 6;
    doc.text(`Date: ${date}`, 10, y);
    y += 6;
    doc.text(`Transcript Count: ${transcriptCount}`, 10, y);
    y += 10;

    // Use the first transcript for PDF download
    const firstTranscript = transcripts[0];
    if (firstTranscript?.entries) {
      firstTranscript.entries.forEach((entry) => {
        const text = `${entry.speaker}: ${entry.text}`;
        const splitText = doc.splitTextToSize(text, 180);

        if (entry.speaker === "Doctor") {
          doc.setTextColor(0, 80, 200);
        } else {
          doc.setTextColor(0, 150, 0);
        }

        doc.text(splitText, 10, y);
        y += splitText.length * 6;

        if (y > 280) {
          doc.addPage();
          y = 10;
        }
      });
    }

    doc.setTextColor(0, 0, 0);
    doc.save(`transcript-${name}.pdf`);
  };

  return (
<div className="p-6 hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200 border-b border-gray-100">
  <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
    {/* Patient Info */}
    <div className="flex items-start space-x-4 flex-1">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-full flex-shrink-0 shadow-md">
        <User className="h-6 w-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 mb-3">
          <h3 className="text-lg font-bold text-gray-900 truncate">{name}</h3>
          <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full text-xs font-semibold whitespace-nowrap shadow-sm w-fit">
            {specialty}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
          <div className="flex items-center whitespace-nowrap text-gray-700">
            <Calendar className="h-4 w-4 mr-2 flex-shrink-0 text-blue-600" />
            <span className="font-medium">{date}</span>
          </div>
          <div className="flex items-center whitespace-nowrap text-gray-700">
            <Clock className="h-4 w-4 mr-2 flex-shrink-0 text-blue-600" />
            <span className="font-medium">{time}</span>
          </div>
          <div className="flex items-center whitespace-nowrap text-gray-700">
            <File className="h-4 w-4 mr-2 flex-shrink-0 text-blue-600" />
            <span className="font-medium">{transcriptCount} Consultation{transcriptCount > 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
    </div>

    {/* Actions */}
    <div className="flex flex-col sm:flex-row gap-3 xl:justify-end">
      <InvertedGradientButton
        onClick={onViewTranscript}
        className="flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
        color="amber"
      >
        <File className="h-4 w-4 mr-2" />
        View Details
      </InvertedGradientButton>
      <GradientButton
        onClick={handleDownloadPdf}
        className="flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
        color="amber"
      >
        <Download className="h-4 w-4 mr-2" />
        Download Report
      </GradientButton>
    </div>
  </div>
</div>
  );
};

export default PatientCard;