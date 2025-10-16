"use client";
import React from 'react';
import { 
  AnimationWrapper, 
  StaggeredAnimationGroup, 
  ScrollReveal,
  useIntersectionObserver 
} from './index';

/**
 * Example component demonstrating the centralized animation system
 */
const AnimationExamples = () => {
  const { ref, isIntersecting } = useIntersectionObserver();

  const features = [
    { id: 1, title: 'Fade In Animation', description: 'Smooth fade-in effect' },
    { id: 2, title: 'Scale Animation', description: 'Elements scale in smoothly' },
    { id: 3, title: 'Zoom Animation', description: 'Elements zoom in from small to normal' },
    { id: 4, title: 'Scroll Reveal', description: 'Animations triggered by scroll position' },
  ];

  const stats = [
    { label: 'Users', value: '10K+' },
    { label: 'Downloads', value: '50K+' },
    { label: 'Reviews', value: '4.9★' },
    { label: 'Countries', value: '25+' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Hero Section with Staggered Animations */}
      <section className="text-center py-16">
        <AnimationWrapper animation="fadeInUp" delay={0.2}>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Centralized Animation System
          </h1>
        </AnimationWrapper>
        
        <AnimationWrapper animation="fadeInUp" delay={0.4}>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            A comprehensive animation system with fade-in and slide-in effects, 
            intersection observer support, and staggered animations.
          </p>
        </AnimationWrapper>
        
        <AnimationWrapper animation="scaleIn" delay={0.6}>
          <button className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors">
            Get Started
          </button>
        </AnimationWrapper>
      </section>

      {/* Feature Cards with Staggered Animation */}
      <section className="py-16">
        <AnimationWrapper animation="fadeInDown" delay={0.2}>
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Animation Features
          </h2>
        </AnimationWrapper>
        
        <StaggeredAnimationGroup 
          animation="fadeInUp" 
          staggerDelay={150}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {features.map(feature => (
            <div 
              key={feature.id}
              className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </StaggeredAnimationGroup>
      </section>

      {/* Stats Section with Different Animation Types */}
      <section className="py-16 bg-white">
        <AnimationWrapper animation="fadeInDown" delay={0.2}>
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Our Impact
          </h2>
        </AnimationWrapper>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <AnimationWrapper 
              key={stat.label}
              animation="scaleIn" 
              delay={0.3 + (index * 0.1)}
            >
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-600">
                  {stat.label}
                </div>
              </div>
            </AnimationWrapper>
          ))}
        </div>
      </section>

      {/* Scroll Reveal Example */}
      <section className="py-16">
        <ScrollReveal animation="zoomIn" threshold={0.2}>
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-12 rounded-lg">
            <h2 className="text-3xl font-bold mb-4">
              Scroll to Reveal
            </h2>
            <p className="text-xl opacity-90">
              This section animates in when it becomes 20% visible in the viewport.
              Try scrolling up and down to see the effect!
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* Different Animation Directions */}
      <section className="py-16">
        <AnimationWrapper animation="fadeInDown" delay={0.2}>
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Animation Directions
          </h2>
        </AnimationWrapper>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <AnimationWrapper animation="fadeInUp" delay={0.3}>
            <div className="bg-green-100 p-6 rounded-lg text-center">
              <h3 className="font-semibold text-green-800">Fade In Up</h3>
            </div>
          </AnimationWrapper>
          
          <AnimationWrapper animation="fadeInDown" delay={0.4}>
            <div className="bg-blue-100 p-6 rounded-lg text-center">
              <h3 className="font-semibold text-blue-800">Fade In Down</h3>
            </div>
          </AnimationWrapper>
          
          <AnimationWrapper animation="fadeInLeft" delay={0.5}>
            <div className="bg-purple-100 p-6 rounded-lg text-center">
              <h3 className="font-semibold text-purple-800">Fade In Left</h3>
            </div>
          </AnimationWrapper>
          
          <AnimationWrapper animation="fadeInRight" delay={0.6}>
            <div className="bg-orange-100 p-6 rounded-lg text-center">
              <h3 className="font-semibold text-orange-800">Fade In Right</h3>
            </div>
          </AnimationWrapper>
        </div>
      </section>

      {/* Custom Animation Example */}
      <section className="py-16">
        <AnimationWrapper 
          animation={{
            animation: 'zoom-in',
            duration: 1.0,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          delay={0.2}
        >
          <div className="bg-yellow-100 p-8 rounded-lg text-center">
            <h2 className="text-2xl font-bold text-yellow-800 mb-4">
              Custom Animation
            </h2>
            <p className="text-yellow-700">
              This uses a custom animation configuration with smooth easing and longer duration.
            </p>
          </div>
        </AnimationWrapper>
      </section>

      {/* Intersection Observer Hook Example */}
      <section className="py-16">
        <div ref={ref} className="bg-gray-200 p-8 rounded-lg text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Intersection Observer Hook
          </h2>
          <p className="text-gray-600">
            This section uses the useIntersectionObserver hook directly.
            Status: {isIntersecting ? 'Visible' : 'Not Visible'}
          </p>
        </div>
      </section>
    </div>
  );
};

export default AnimationExamples;
