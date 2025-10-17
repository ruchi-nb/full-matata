"use client";
import { useState, useEffect, useRef } from 'react';

/**
 * Hook for intersection observer-based animations
 * Triggers animation when element enters viewport
 */
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const ref = useRef(null);

  const {
    threshold = 0.1,
    rootMargin = '0px',
    triggerOnce = true,
    root = null
  } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isElementIntersecting = entry.isIntersecting;
        setIsIntersecting(isElementIntersecting);
        
        if (isElementIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
        
        if (!triggerOnce && !isElementIntersecting) {
          setHasIntersected(false);
        }
      },
      {
        threshold,
        rootMargin,
        root
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, triggerOnce, root, hasIntersected]);

  return { ref, isIntersecting, hasIntersected };
};

/**
 * Hook for scroll-based animations with progress tracking
 */
export const useScrollAnimation = (options = {}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  const {
    threshold = 0.1,
    rootMargin = '0px',
    root = null
  } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const { isIntersecting, intersectionRatio } = entry;
        setIsVisible(isIntersecting);
        setScrollProgress(intersectionRatio);
      },
      {
        threshold: Array.from({ length: 11 }, (_, i) => i * 0.1), // 0, 0.1, 0.2, ..., 1
        rootMargin,
        root
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, root]);

  return { ref, scrollProgress, isVisible };
};

/**
 * Hook for staggered animations
 * Useful for animating lists or groups of elements
 */
export const useStaggeredAnimation = (itemCount, options = {}) => {
  const [visibleItems, setVisibleItems] = useState(new Set());
  const { ref, isIntersecting } = useIntersectionObserver(options);

  const {
    staggerDelay = 100, // milliseconds
    startDelay = 0
  } = options;

  useEffect(() => {
    if (!isIntersecting) return;

    const timeouts = [];
    
    for (let i = 0; i < itemCount; i++) {
      const timeout = setTimeout(() => {
        setVisibleItems(prev => new Set([...prev, i]));
      }, startDelay + (i * staggerDelay));
      
      timeouts.push(timeout);
    }

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [isIntersecting, itemCount, staggerDelay, startDelay]);

  const isItemVisible = (index) => visibleItems.has(index);

  return { ref, isItemVisible, visibleItems };
};

export default useIntersectionObserver;
