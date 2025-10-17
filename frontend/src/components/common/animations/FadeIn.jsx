// components/common/animations/FadeIn.jsx
"use client"
import React from 'react';
import BaseAnimation from './BaseAnimation';

const FadeIn = ({ 
  children, 
  duration = 0.6, 
  delay = 0, 
  direction = 'up',
  speed = 1,
  className = '',
  ...props 
}) => {
  const getAnimationClass = () => {
    switch (direction) {
      case 'up': return 'fade-in-up';
      case 'down': return 'fade-in-down';
      case 'left': return 'fade-in-left';
      case 'right': return 'fade-in-right';
      default: return 'fade-in';
    }
  };

  return (
    <BaseAnimation
      animation={getAnimationClass()}
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

export default FadeIn;