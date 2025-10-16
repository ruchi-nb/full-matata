# Centralized Animation System

A comprehensive animation system for React applications with fade-in, scale, and zoom animations, intersection observer support.

## Features

- 🎭 **Fade Animations**: Multiple fade variants (up, down, left, right, slow, fast)
- 📏 **Scale Animations**: Smooth scale effects from small to normal
- 🔍 **Zoom Animations**: Zoom effects from very small to normal
- 👁️ **Intersection Observer**: Animations triggered when elements enter viewport
- 🎨 **Customizable**: Duration, easing, delay, and direction controls
- 📱 **Performance Optimized**: Uses CSS animations and efficient observers

## Quick Start

```jsx
import { AnimationWrapper, StaggeredAnimationGroup } from '@/components/common/animations';

// Basic fade-in animation
<AnimationWrapper animation="fadeIn">
  <div>This will fade in when it enters the viewport</div>
</AnimationWrapper>

// Scale-in animation
<AnimationWrapper animation="scaleIn" direction="center">
  <div>This will scale in from small to normal</div>
</AnimationWrapper>

// Staggered animations for lists
<StaggeredAnimationGroup animation="fadeInUp" staggerDelay={150}>
  {items.map(item => (
    <div key={item.id}>{item.content}</div>
  ))}
</StaggeredAnimationGroup>
```

## Components

### AnimationWrapper

The main animation component that wraps any content and applies animations when it enters the viewport.

```jsx
<AnimationWrapper
  animation="fadeIn"           // Animation preset or custom config
  duration={0.5}              // Duration in seconds
  delay={0.2}                 // Delay in seconds
  easing="ease-out"           // Easing function
  direction="up"              // Direction for directional animations
  threshold={0.1}             // Intersection observer threshold
  rootMargin="0px"            // Intersection observer root margin
  triggerOnce={true}          // Only animate once
  className="my-class"        // Additional CSS classes
>
  <div>Your content here</div>
</AnimationWrapper>
```

### StaggeredAnimationGroup

Animates a group of children with staggered timing.

```jsx
<StaggeredAnimationGroup
  animation="fadeInUp"        // Animation to apply to each child
  staggerDelay={100}         // Delay between each child (ms)
  startDelay={0}             // Initial delay (ms)
>
  {children}
</StaggeredAnimationGroup>
```

### ScrollReveal

Simplified component for scroll-triggered animations.

```jsx
<ScrollReveal animation="zoomIn" threshold={0.2}>
  <div>Reveals when 20% visible</div>
</ScrollReveal>
```

## Animation Presets

### Fade Animations
- `fadeIn` - Simple fade in
- `fadeInUp` - Fade in from bottom
- `fadeInDown` - Fade in from top
- `fadeInLeft` - Fade in from left
- `fadeInRight` - Fade in from right

### Scale Animations
- `scaleIn` - Scale from small to normal
- `zoomIn` - Zoom from very small

## Custom Animations

You can create custom animations by passing an object instead of a preset name:

```jsx
<AnimationWrapper
  animation={{
    animation: 'fade-in',
    duration: 1.0,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  }}
>
  <div>Custom animation</div>
</AnimationWrapper>
```

## Hooks

### useIntersectionObserver

Hook for intersection observer functionality.

```jsx
import { useIntersectionObserver } from '@/components/common/animations';

const MyComponent = () => {
  const { ref, isIntersecting, hasIntersected } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '0px',
    triggerOnce: true
  });

  return (
    <div ref={ref}>
      {hasIntersected ? 'Visible!' : 'Not visible'}
    </div>
  );
};
```

### useStaggeredAnimation

Hook for staggered animations.

```jsx
import { useStaggeredAnimation } from '@/components/common/animations';

const MyList = ({ items }) => {
  const { ref, isItemVisible } = useStaggeredAnimation(items.length, {
    staggerDelay: 100,
    startDelay: 0
  });

  return (
    <div ref={ref}>
      {items.map((item, index) => (
        <div 
          key={index}
          className={isItemVisible(index) ? 'animate-fade-in' : 'opacity-0'}
        >
          {item}
        </div>
      ))}
    </div>
  );
};
```

## Animation Utilities

### Easing Functions

```jsx
import { easing } from '@/components/common/animations';

// Available easing functions:
easing.linear
easing.ease
easing.easeIn
easing.easeOut
easing.easeInOut
easing.smooth
easing.bounce
easing.elastic
easing.back
easing.material
```

### Duration Presets

```jsx
import { duration } from '@/components/common/animations';

// Available durations:
duration.instant  // 0.1s
duration.fast     // 0.2s
duration.normal   // 0.3s
duration.medium   // 0.5s
duration.slow     // 0.8s
duration.slower   // 1.2s
duration.slowest  // 1.6s
```

## CSS Classes

The system also provides CSS classes for direct use:

```css
/* Fade animations */
.animate-fade-in
.animate-fade-in-up
.animate-fade-in-down
.animate-fade-in-left
.animate-fade-in-right
.animate-fade-in-slow
.animate-fade-in-fast

/* Scale animations */
.animate-scale-in
.animate-zoom-in

/* Delay classes */
.animate-delay-100
.animate-delay-200
.animate-delay-300
/* ... up to 1000 */
```

## Examples

### Landing Page Hero Section

```jsx
<AnimationWrapper animation="fadeInUp" delay={0.2}>
  <h1>Welcome to Our App</h1>
</AnimationWrapper>

<AnimationWrapper animation="fadeInUp" delay={0.4}>
  <p>Discover amazing features</p>
</AnimationWrapper>

<AnimationWrapper animation="scaleIn" delay={0.6}>
  <button>Get Started</button>
</AnimationWrapper>
```

### Feature Cards

```jsx
<StaggeredAnimationGroup animation="fadeInUp" staggerDelay={200}>
  {features.map(feature => (
    <div key={feature.id} className="feature-card">
      <h3>{feature.title}</h3>
      <p>{feature.description}</p>
    </div>
  ))}
</StaggeredAnimationGroup>
```

### Navigation Menu

```jsx
<AnimationWrapper animation="scaleIn" duration={0.3}>
  <nav className="navbar">
    <ul>
      <li>Home</li>
      <li>About</li>
      <li>Contact</li>
    </ul>
  </nav>
</AnimationWrapper>
```

## Performance Tips

1. **Use `triggerOnce={true}`** for elements that should only animate once
2. **Set appropriate `threshold`** values to control when animations trigger
3. **Use `rootMargin`** to trigger animations before elements are fully visible
4. **Prefer CSS animations** over JavaScript animations for better performance
5. **Use `will-change`** CSS property for elements that will animate

## Browser Support

- Modern browsers with Intersection Observer API support
- Graceful degradation for older browsers (animations will still work, just without intersection observer)
- CSS animations work in all modern browsers

## Migration from Existing System

If you're migrating from the existing animation system:

1. Replace `<FadeIn>` with `<AnimationWrapper animation="fadeIn">`
2. Replace `<SlideIn>` with `<AnimationWrapper animation="scaleIn">`
3. Use `StaggeredAnimationGroup` for lists instead of manual delay calculations
4. Import from the main index file for cleaner imports
