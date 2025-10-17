"use client";
import React from 'react';
import { useIntersectionObserver, useStaggeredAnimation } from './useIntersectionObserver';
import { presets, createAnimationStyle } from './animationUtils';
import './animations.css';

/**
 * Centralized AnimationWrapper component
 * Provides easy-to-use animation wrapper with intersection observer
 */
const AnimationWrapper = ({
  children,
  animation = 'fadeIn',
  duration,
  delay = 0,
  easing,
  speed = 1,
  direction = 'up',
  className = '',
  style = {},
  triggerOnce = true,
  threshold = 0.1,
  rootMargin = '0px',
  stagger = false,
  staggerDelay = 100,
  staggerIndex = 0,
  ...props
}) => {
  // Get animation preset or use custom values
  const preset = typeof animation === 'string' ? presets[animation] : animation;
  const animationName = preset?.animation || animation;
  const animationDuration = duration || preset?.duration;
  const animationEasing = easing || preset?.easing;

  // Handle staggered animations
  const { ref: staggerRef, isItemVisible } = useStaggeredAnimation(
    stagger ? 1 : 0,
    { threshold, rootMargin, triggerOnce, staggerDelay }
  );

  // Handle regular intersection observer
  const { ref: observerRef, hasIntersected } = useIntersectionObserver({
    threshold,
    rootMargin,
    triggerOnce
  });

  // Choose the appropriate ref
  const ref = stagger ? staggerRef : observerRef;
  const shouldAnimate = stagger ? isItemVisible(staggerIndex) : hasIntersected;

  // Create animation style
  const animationStyle = createAnimationStyle({
    animation: animationName,
    duration: animationDuration,
    easing: animationEasing,
    delay: delay + (stagger ? staggerIndex * (staggerDelay / 1000) : 0),
    speed
  });

  // Handle direction-based animations
  const getDirectionalAnimation = () => {
    if (animationName.includes('fade-in') && direction !== 'up') {
      return `fade-in-${direction}`;
    }
    if (animationName.includes('slide-in') && direction !== 'left') {
      return `slide-in-${direction}`;
    }
    return animationName;
  };

  const finalAnimationStyle = {
    ...animationStyle,
    animation: animationStyle.animation.replace(
      animationName,
      getDirectionalAnimation()
    ),
    ...style
  };

  return (
    <div
      ref={ref}
      className={`animate-${getDirectionalAnimation()} ${className}`}
      style={shouldAnimate ? finalAnimationStyle : { opacity: 0, ...style }}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * StaggeredAnimationGroup component for animating lists
 */
export const StaggeredAnimationGroup = ({
  children,
  animation = 'fadeIn',
  staggerDelay = 100,
  startDelay = 0,
  className = '',
  ...props
}) => {
  const childrenArray = React.Children.toArray(children);
  
  return (
    <div className={className} {...props}>
      {childrenArray.map((child, index) => (
        <AnimationWrapper
          key={index}
          animation={animation}
          stagger={true}
          staggerIndex={index}
          staggerDelay={staggerDelay}
          delay={startDelay}
        >
          {child}
        </AnimationWrapper>
      ))}
    </div>
  );
};

/**
 * ScrollReveal component for scroll-triggered animations
 */
export const ScrollReveal = ({
  children,
  animation = 'fadeIn',
  threshold = 0.1,
  rootMargin = '0px',
  className = '',
  ...props
}) => {
  return (
    <AnimationWrapper
      animation={animation}
      threshold={threshold}
      rootMargin={rootMargin}
      className={className}
      {...props}
    >
      {children}
    </AnimationWrapper>
  );
};

export default AnimationWrapper;
