// components/common/animations/ScaleIn.jsx
"use client"
import React from 'react';
import BaseAnimation from './BaseAnimation';

const ScaleIn = ({ 
  children, 
  duration = 0.5, 
  delay = 0, 
  speed = 1,
  className = '',
  ...props 
}) => {
  return (
    <BaseAnimation
      animation="scale-in"
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

export default ScaleIn;