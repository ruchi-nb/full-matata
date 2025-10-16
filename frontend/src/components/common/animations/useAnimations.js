"use client";

// components/common/animations/useAnimation.js
import { useState, useEffect } from 'react';

const useAnimation = (trigger = true, delay = 0) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (trigger) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [trigger, delay]);

  return isVisible;
};

export default useAnimation;