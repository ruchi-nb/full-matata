// components/common/animations/BaseAnimation.jsx
"use client"
import React from 'react';

const BaseAnimation = ({ 
  children, 
  animation, 
  duration = 0.5, 
  delay = 0, 
  easing = 'ease-out',
  speed = 1,
  className = '',
  style = {},
  ...props 
}) => {
  // Calculate actual duration based on speed (speed = 1 is normal, 2 is double speed, 0.5 is half speed)
  const actualDuration = duration / speed;
  
  const animationStyle = {
    animation: `${animation} ${actualDuration}s ${easing} ${delay}s both`,
    ...style
  };

  return (
    <div 
      className={`animate-${animation} ${className}`}  // Fixed: Added animate- prefix
      style={animationStyle}
      {...props}
    >
      {children}
    </div>
  );
};

export default BaseAnimation;