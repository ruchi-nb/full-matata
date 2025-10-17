// GradientButton.js
import React from "react";

export default function GradientButton({ 
  children, 
  onClick, 
  className = "", 
  color = "blue", // Default color
  size = "medium", // Default size
  disabled = false,
  icon = null // Optional icon
}) {
  
  // Color gradient classes based on the color prop
  const colorGradients = {
    blue: "bg-gradient-to-r from-[#004dd6] to-[#3d85c6] hover:from-[#003cb3] hover:to-[#2d75b6]",
    red: "bg-gradient-to-r from-[#dc2626] to-[#ef4444] hover:from-[#c51a1a] hover:to-[#dc2626]",
    green: "bg-gradient-to-r from-[#059669] to-[#10b981] hover:from-[#047857] hover:to-[#059669]",
    purple: "bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:from-[#6d28d9] hover:to-[#7c3aed]",
    indigo: "bg-gradient-to-r from-[#3730a3] to-[#6366f1] hover:from-[#312e81] hover:to-[#3730a3]",
    pink: "bg-gradient-to-r from-[#db2777] to-[#ec4899] hover:from-[#be185d] hover:to-[#db2777]",
    orange: "bg-gradient-to-r from-[#ea580c] to-[#f97316] hover:from-[#c2410c] hover:to-[#ea580c]",
    teal: "bg-gradient-to-r from-[#0d9488] to-[#14b8a6] hover:from-[#0f766e] hover:to-[#0d9488]",
    gold: "bg-gradient-to-r from-[#d4af37] to-[#facc15] hover:from-[#b8931c] hover:to-[#d4af37]",   
    amber: "bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] hover:from-[#d97706] hover:to-[#f59e0b]", 
    sunflower: "bg-gradient-to-r from-[#eab308] to-[#fde047] hover:from-[#ca8a04] hover:to-[#eab308]", 
    bronze: "bg-gradient-to-r from-[#b87333] to-[#f59e0b] hover:from-[#925a1b] hover:to-[#b87333]", 
    champagne: "bg-gradient-to-r from-[#f7e7ce] to-[#facc15] hover:from-[#e5d5b8] hover:to-[#f7e7ce]"
  };

  // Size classes based on the size prop
  const sizeClasses = {
    small: "py-1 px-3 text-sm",
    medium: "py-2 px-4 text-base",
    large: "py-3 px-6 text-lg"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        group flex items-center justify-center gap-2
        rounded-full border border-transparent text-white
        transition-all duration-300 transform hover:scale-105 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:scale-100
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current
        ${colorGradients[color] || colorGradients.blue}
        ${sizeClasses[size] || sizeClasses.medium}
        ${className}
      `}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </button>
  );
}