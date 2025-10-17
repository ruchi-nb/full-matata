"use client";
import React from 'react';
import { LifeLine } from 'react-loading-indicators';

const LoadingSpinner = ({ 
  size = 'md', 
  color = 'blue', 
  text = '', 
  fullScreen = false,
  className = '' 
}) => {
  const sizeMap = {
    sm: 'small',
    md: 'medium',
    lg: 'large',
    xl: 'large'
  };

  const colorMap = {
    blue: '#3b82f6',
    white: '#ffffff',
    gray: '#6b7280',
    green: '#10b981',
    red: '#ef4444'
  };

  const spinner = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <LifeLine
        color={colorMap[color]}
        size={sizeMap[size]}
        text={text}
        textColor={colorMap[color]}
      />
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
