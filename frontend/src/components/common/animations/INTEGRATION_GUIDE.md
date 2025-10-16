# Integration Guide

## Quick Integration Steps

### 1. Import the Animation System

```jsx
// Import the main components
import { 
  AnimationWrapper, 
  StaggeredAnimationGroup, 
  ScrollReveal 
} from '@/components/common/animations';

// Or import specific utilities
import { 
  useIntersectionObserver, 
  presets, 
  easing, 
  duration 
} from '@/components/common/animations';
```

### 2. Wrap Your Components

Replace static content with animated versions:

```jsx
// Before
<div className="card">
  <h2>Title</h2>
  <p>Content</p>
</div>

// After
<AnimationWrapper animation="fadeInUp" delay={0.2}>
  <div className="card">
    <h2>Title</h2>
    <p>Content</p>
  </div>
</AnimationWrapper>
```

### 3. Animate Lists and Cards

```jsx
// Before
{items.map(item => (
  <div key={item.id} className="item">
    {item.content}
  </div>
))}

// After
<StaggeredAnimationGroup animation="fadeInUp" staggerDelay={150}>
  {items.map(item => (
    <div key={item.id} className="item">
      {item.content}
    </div>
  ))}
</StaggeredAnimationGroup>
```

### 4. Update Your Layout

Add the animation provider to your root layout:

```jsx
// In your main layout file
import { AnimationProvider } from '@/components/common/animations';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AnimationProvider defaultDuration={0.5} defaultEasing="ease-out">
          {children}
        </AnimationProvider>
      </body>
    </html>
  );
}
```

## Common Use Cases

### Landing Page Hero
```jsx
<section className="hero">
  <AnimationWrapper animation="fadeInUp" delay={0.2}>
    <h1>Welcome to Our App</h1>
  </AnimationWrapper>
  
  <AnimationWrapper animation="fadeInUp" delay={0.4}>
    <p>Discover amazing features</p>
  </AnimationWrapper>
  
  <AnimationWrapper animation="scaleIn" delay={0.6}>
    <button>Get Started</button>
  </AnimationWrapper>
</section>
```

### Feature Grid
```jsx
<section className="features">
  <AnimationWrapper animation="fadeInDown">
    <h2>Our Features</h2>
  </AnimationWrapper>
  
  <StaggeredAnimationGroup animation="fadeInUp" staggerDelay={200}>
    {features.map(feature => (
      <div key={feature.id} className="feature-card">
        <h3>{feature.title}</h3>
        <p>{feature.description}</p>
      </div>
    ))}
  </StaggeredAnimationGroup>
</section>
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

### Modal/Dialog
```jsx
<AnimationWrapper animation="scaleIn" duration={0.3}>
  <div className="modal">
    <h2>Modal Title</h2>
    <p>Modal content</p>
  </div>
</AnimationWrapper>
```

## Performance Tips

1. **Use `triggerOnce={true}`** for elements that should only animate once
2. **Set appropriate `threshold`** values (0.1 = 10% visible)
3. **Use `rootMargin`** to trigger animations before elements are fully visible
4. **Prefer CSS animations** over JavaScript animations
5. **Test on mobile devices** for performance

## Migration Checklist

- [ ] Import animation components
- [ ] Wrap static content with AnimationWrapper
- [ ] Convert lists to StaggeredAnimationGroup
- [ ] Add AnimationProvider to root layout
- [ ] Test animations on different screen sizes
- [ ] Adjust timing and delays as needed
- [ ] Remove old animation code

## Troubleshooting

### Animations not working?
- Check if CSS file is imported
- Verify intersection observer support
- Ensure elements have content/height

### Performance issues?
- Use `triggerOnce={true}`
- Reduce animation duration
- Check for too many simultaneous animations

### Staggered animations not working?
- Ensure children are direct children of StaggeredAnimationGroup
- Check staggerDelay value (in milliseconds)
- Verify animation preset exists
