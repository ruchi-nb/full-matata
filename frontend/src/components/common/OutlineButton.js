// components/OutlineButton.js
import React from "react";

export default function OutlineButton({ 
  children, 
  onClick, 
  className = "", 
  color = "blue", // Default color
  size = "medium", // Default size
  disabled = false,
  icon = null // Optional icon
}) {
  
  // Color classes based on the color prop
  const colorClasses = {
    blue: "border-blue-500 text-blue-500 hover:bg-blue-500/10",
    red: "border-red-500 text-red-500 hover:bg-red-500/10",
    green: "border-green-500 text-green-500 hover:bg-green-500/10",
    yellow: "border-yellow-500 text-yellow-500 hover:bg-yellow-500/10",
    purple: "border-purple-500 text-purple-500 hover:bg-purple-500/10",
    indigo: "border-indigo-500 text-indigo-500 hover:bg-indigo-500/10",
    pink: "border-pink-500 text-pink-500 hover:bg-pink-500/10",
    gray: "border-gray-500 text-gray-500 hover:bg-gray-500/10"
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
        group flex items-center justify-center space-x-2
        rounded-full border font-medium
        transition-all duration-300 transform hover:scale-105
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        ${colorClasses[color]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </button>
  );
}