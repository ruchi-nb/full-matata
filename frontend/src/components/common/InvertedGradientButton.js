// InvertedGradientButton.js
import React from "react";

export default function InvertedGradientButton({ 
  children, 
  onClick, 
  className = "", 
  color = "blue", // Default color
  size = "medium", // Default size
  disabled = false,
  icon = null // Optional icon
 }) {

  // Base gradient classes for hover effect
  const colorGradients = {
    blue: "hover:bg-gradient-to-r hover:from-[#004dd6] hover:to-[#3d85c6]",
    red: "hover:bg-gradient-to-r hover:from-[#dc2626] hover:to-[#ef4444]",
    green: "hover:bg-gradient-to-r hover:from-[#059669] hover:to-[#10b981]",
    purple: "hover:bg-gradient-to-r hover:from-[#7c3aed] hover:to-[#a855f7]",
    indigo: "hover:bg-gradient-to-r hover:from-[#3730a3] hover:to-[#6366f1]",
    pink: "hover:bg-gradient-to-r hover:from-[#db2777] hover:to-[#ec4899]",
    orange: "hover:bg-gradient-to-r hover:from-[#ea580c] hover:to-[#f97316]",
    teal: "hover:bg-gradient-to-r hover:from-[#0d9488] hover:to-[#14b8a6]",
    gold: "hover:bg-gradient-to-r hover:from-[#d4af37] hover:to-[#facc15]",   
    amber: "hover:bg-gradient-to-r hover:from-[#f59e0b] hover:to-[#fbbf24]", 
    sunflower: "hover:bg-gradient-to-r hover:from-[#eab308] hover:to-[#fde047]", 
    bronze: "hover:bg-gradient-to-r hover:from-[#b87333] hover:to-[#f59e0b]", 
    champagne: "hover:bg-gradient-to-r hover:from-[#f7e7ce] hover:to-[#facc15]"
  };

  // Text and border colors based on the color prop
  const colorStyles = {
    blue: "text-blue-600 border-blue-600 hover:text-white hover:border-transparent",
    red: "text-red-600 border-red-600 hover:text-white hover:border-transparent",
    green: "text-green-600 border-green-600 hover:text-white hover:border-transparent",
    purple: "text-purple-600 border-purple-600 hover:text-white hover:border-transparent",
    indigo: "text-indigo-600 border-indigo-600 hover:text-white hover:border-transparent",
    pink: "text-pink-600 border-pink-600 hover:text-white hover:border-transparent",
    orange: "text-orange-600 border-orange-600 hover:text-white hover:border-transparent",
    teal: "text-teal-600 border-teal-600 hover:text-white hover:border-transparent",
    gold: "text-yellow-600 border-yellow-600 hover:text-white hover:border-transparent",
    amber: "text-amber-600 border-amber-600 hover:text-white hover:border-transparent",
    sunflower: "text-yellow-500 border-yellow-500 hover:text-white hover:border-transparent",
    bronze: "text-amber-700 border-amber-700 hover:text-white hover:border-transparent",
    champagne: "text-yellow-400 border-yellow-400 hover:text-white hover:border-transparent"
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
        rounded-full border-2 bg-white
        transition-all duration-300 transform hover:scale-105 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:scale-100
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current
        ${colorGradients[color] || colorGradients.blue}
        ${colorStyles[color] || colorStyles.blue}
        ${sizeClasses[size] || sizeClasses.medium}
        ${className}
      `}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </button>
  );
}