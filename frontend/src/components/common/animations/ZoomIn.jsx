// components/common/animations/ZoomIn.jsx
"use client"
import React from 'react';
import BaseAnimation from './BaseAnimation';

const ZoomIn = ({ 
  children, 
  duration = 0.5, 
  delay = 0, 
  speed = 1,
  className = '',
  ...props 
}) => {
  return (
    <BaseAnimation
      animation="zoom-in"
      duration={duration}
      delay={delay}
      speed={speed}
      className={className}
      {...props}
    >
      {children}
    </BaseAnimation>
  );
};

export default ZoomIn;