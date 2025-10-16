// components/common/animations/AnimationProvider.jsx
"use client"
import React, { createContext, useContext } from 'react';

const AnimationContext = createContext();

export const useAnimationContext = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimationContext must be used within AnimationProvider');
  }
  return context;
};

const AnimationProvider = ({ children, defaultDuration = 0.5, defaultEasing = 'ease-out' }) => {
  const value = {
    defaultDuration,
    defaultEasing,
  };

  return (
    <AnimationContext.Provider value={value}>
      {children}
    </AnimationContext.Provider>
  );
};

export default AnimationProvider;