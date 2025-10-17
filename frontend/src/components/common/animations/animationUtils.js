"use client";

/**
 * Animation utility functions for consistent timing and easing
 */

// Predefined easing functions
export const easing = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  // Custom cubic-bezier curves
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  back: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
  // Material Design curves
  material: 'cubic-bezier(0.4, 0, 0.2, 1)',
  materialAccelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  materialDecelerate: 'cubic-bezier(0, 0, 0.2, 1)',
};

// Predefined duration presets
export const duration = {
  instant: 0.1,
  fast: 0.2,
  normal: 0.3,
  medium: 0.5,
  slow: 0.8,
  slower: 1.2,
  slowest: 1.6,
};

// Animation presets for common use cases
export const presets = {
  // Fade animations
  fadeIn: {
    duration: duration.normal,
    easing: easing.easeOut,
    animation: 'fade-in'
  },
  fadeInUp: {
    duration: duration.medium,
    easing: easing.easeOut,
    animation: 'fade-in-up'
  },
  fadeInDown: {
    duration: duration.medium,
    easing: easing.easeOut,
    animation: 'fade-in-down'
  },
  fadeInLeft: {
    duration: duration.medium,
    easing: easing.easeOut,
    animation: 'fade-in-left'
  },
  fadeInRight: {
    duration: duration.medium,
    easing: easing.easeOut,
    animation: 'fade-in-right'
  },
  
  
  // Scale animations
  scaleIn: {
    duration: duration.normal,
    easing: easing.easeOut,
    animation: 'scale-in'
  },
  zoomIn: {
    duration: duration.normal,
    easing: easing.easeOut,
    animation: 'zoom-in'
  },
};

/**
 * Generate CSS animation string
 * @param {string} animation - Animation name
 * @param {number} duration - Duration in seconds
 * @param {string} easing - Easing function
 * @param {number} delay - Delay in seconds
 * @returns {string} CSS animation string
 */
export const generateAnimationString = (animation, duration, easing, delay = 0) => {
  return `${animation} ${duration}s ${easing} ${delay}s both`;
};

/**
 * Generate CSS transition string
 * @param {string} property - CSS property to transition
 * @param {number} duration - Duration in seconds
 * @param {string} easing - Easing function
 * @param {number} delay - Delay in seconds
 * @returns {string} CSS transition string
 */
export const generateTransitionString = (property, duration, easing, delay = 0) => {
  return `${property} ${duration}s ${easing} ${delay}s`;
};

/**
 * Calculate staggered delay
 * @param {number} index - Item index
 * @param {number} staggerDelay - Delay between items in seconds
 * @param {number} startDelay - Initial delay in seconds
 * @returns {number} Calculated delay
 */
export const calculateStaggerDelay = (index, staggerDelay = 0.1, startDelay = 0) => {
  return startDelay + (index * staggerDelay);
};

/**
 * Get animation class name with modifiers
 * @param {string} baseAnimation - Base animation name
 * @param {Object} modifiers - Animation modifiers
 * @returns {string} Complete class name
 */
export const getAnimationClassName = (baseAnimation, modifiers = {}) => {
  const { duration, delay, speed } = modifiers;
  let className = `animate-${baseAnimation}`;
  
  if (delay) {
    const delayClass = `animate-delay-${Math.round(delay * 1000)}`;
    className += ` ${delayClass}`;
  }
  
  return className;
};

/**
 * Create animation style object
 * @param {Object} config - Animation configuration
 * @returns {Object} Style object
 */
export const createAnimationStyle = (config) => {
  const {
    animation,
    duration: dur = duration.normal,
    easing: ease = easing.easeOut,
    delay = 0,
    speed = 1
  } = config;
  
  const actualDuration = dur / speed;
  
  return {
    animation: generateAnimationString(animation, actualDuration, ease, delay),
  };
};

export default {
  easing,
  duration,
  presets,
  generateAnimationString,
  generateTransitionString,
  calculateStaggerDelay,
  getAnimationClassName,
  createAnimationStyle,
};
