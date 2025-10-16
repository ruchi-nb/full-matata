// components/common/animations/index.js

// Original animation components
export { default as FadeIn } from './FadeIn';
export { default as ScaleIn } from './ScaleIn';
export { default as ZoomIn } from './ZoomIn';
export { default as AnimationProvider } from './AnimationProvider';
export { default as useAnimation } from './useAnimations';

// Enhanced animation components
export { default as AnimationWrapper } from './AnimationWrapper';
export { StaggeredAnimationGroup, ScrollReveal } from './AnimationWrapper';

// Animation hooks
export { 
  useIntersectionObserver, 
  useScrollAnimation, 
  useStaggeredAnimation 
} from './useIntersectionObserver';

// Animation utilities
export { 
  easing, 
  duration, 
  presets,
  generateAnimationString,
  generateTransitionString,
  calculateStaggerDelay,
  getAnimationClassName,
  createAnimationStyle
} from './animationUtils';

// Default export for easy importing
export { default } from './AnimationWrapper';