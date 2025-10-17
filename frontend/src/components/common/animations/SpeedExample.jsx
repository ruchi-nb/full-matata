"use client";

import React from 'react';
import { FadeIn, ScaleIn, ZoomIn } from './index';

const SpeedExample = () => {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold mb-8">Animation Speed Examples</h1>
      
      {/* Speed Examples */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Slow Speed (0.5x) */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-blue-600">Slow (0.5x)</h2>
          
          <FadeIn direction="up" speed={0.5} duration={1}>
            <div className="bg-blue-100 p-4 rounded">
              <p>Slow Fade In</p>
            </div>
          </FadeIn>
          
          <ScaleIn speed={0.5} duration={1}>
            <div className="bg-blue-100 p-4 rounded">
              <p>Slow Scale In</p>
            </div>
          </ScaleIn>
        </div>
        
        {/* Normal Speed (1x) */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-green-600">Normal (1x)</h2>
          
          <FadeIn direction="up" speed={1} duration={0.6}>
            <div className="bg-green-100 p-4 rounded">
              <p>Normal Fade In</p>
            </div>
          </FadeIn>
          
          <ScaleIn speed={1} duration={0.5}>
            <div className="bg-green-100 p-4 rounded">
              <p>Normal Scale In</p>
            </div>
          </ScaleIn>
        </div>
        
        {/* Fast Speed (2x) */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-red-600">Fast (2x)</h2>
          
          <FadeIn direction="up" speed={2} duration={0.6}>
            <div className="bg-red-100 p-4 rounded">
              <p>Fast Fade In</p>
            </div>
          </FadeIn>
          
          <ScaleIn speed={2} duration={0.5}>
            <div className="bg-red-100 p-4 rounded">
              <p>Fast Scale In</p>
            </div>
          </ScaleIn>
        </div>
      </div>
      
      {/* Special Animations */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Special Animations</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <ZoomIn speed={0.8} duration={0.5}>
            <div className="bg-pink-100 p-4 rounded text-center">
              <p>Medium Zoom</p>
            </div>
          </ZoomIn>
          
          <ZoomIn speed={1.2} duration={0.6}>
            <div className="bg-cyan-100 p-4 rounded text-center">
              <p>Fast Zoom</p>
            </div>
          </ZoomIn>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">My Animations</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FadeIn direction="left" speed={1} duration={0.6}>
          <ScaleIn direction="left" speed={1} duration={0.6}>
              <div className="bg-pink-100 p-4 rounded text-center">left</div>
          </ScaleIn>
        </FadeIn>
        
        <FadeIn direction="up" speed={1} duration={0.6}>
          <ScaleIn direction="up" speed={1} duration={0.6}>
              <div className="bg-pink-100 p-4 rounded text-center">up</div>
          </ScaleIn>
        </FadeIn>

        <FadeIn direction="down" speed={1} duration={0.6}>
          <ScaleIn direction="down" speed={1} duration={0.6}>
              <div className="bg-pink-100 p-4 rounded text-center">down</div>
          </ScaleIn>
        </FadeIn>

        <FadeIn direction="right" speed={1} duration={0.6}>
          <ScaleIn direction="right" speed={1} duration={0.6}>
              <div className="bg-pink-100 p-4 rounded text-center">right</div>
          </ScaleIn>
        </FadeIn>
        </div>
      </div>
      
      {/* Usage Examples */}
      <div className="mt-8 p-6 bg-gray-100 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Usage Examples</h2>
        <div className="space-y-2 text-sm font-mono">
          <p>{"<FadeIn speed={0.5}>Slow animation</FadeIn>"}</p>
          <p>{"<ScaleIn speed={2}>Fast animation</ScaleIn>"}</p>
          <p>{"<ZoomIn speed={1.5}>Fast zooming</ZoomIn>"}</p>
          <p>{"<ScaleIn speed={0.8} duration={0.6}>Custom speed & duration</ScaleIn>"}</p>
        </div>
      </div>
    </div>
  );
};

export default SpeedExample;
