import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  inputAnalyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
  isActive: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ inputAnalyser, outputAnalyser, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const inputDataArray = new Uint8Array(inputAnalyser?.frequencyBinCount || 128);
    const outputDataArray = new Uint8Array(outputAnalyser?.frequencyBinCount || 128);

    const draw = () => {
      if (!isActive) {
        // Idle state: gentle pulsing circle
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        const time = Date.now() * 0.002;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const baseRadius = 50;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius + Math.sin(time) * 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.2)'; // Indigo 500
        ctx.fill();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Collect data
      if (inputAnalyser) inputAnalyser.getByteFrequencyData(inputDataArray);
      if (outputAnalyser) outputAnalyser.getByteFrequencyData(outputDataArray);

      // Calculate average volumes
      let inputSum = 0;
      let outputSum = 0;
      for (let i = 0; i < inputDataArray.length; i++) inputSum += inputDataArray[i];
      for (let i = 0; i < outputDataArray.length; i++) outputSum += outputDataArray[i];
      
      const inputAvg = inputSum / inputDataArray.length;
      const outputAvg = outputSum / outputDataArray.length;

      // Determine who is talking primarily to color code
      const isOutputDominant = outputAvg > inputAvg;
      const primaryColor = isOutputDominant ? '236, 72, 153' : '99, 102, 241'; // Pink (AI) vs Indigo (User)
      
      const combinedAvg = Math.max(inputAvg, outputAvg);
      const scale = 1 + (combinedAvg / 255) * 1.5; // Scale factor based on volume

      ctx.clearRect(0, 0, rect.width, rect.height);
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radius = 60 * scale;

      // Draw glow
      const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius * 1.5);
      gradient.addColorStop(0, `rgba(${primaryColor}, 0.8)`);
      gradient.addColorStop(1, `rgba(${primaryColor}, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw core
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${primaryColor})`;
      ctx.fill();

      // Draw particles (simple effect)
      if (combinedAvg > 20) {
        const particleCount = 8;
        for (let i = 0; i < particleCount; i++) {
          const angle = (Date.now() * 0.001) + (i * (Math.PI * 2) / particleCount);
          const pRadius = radius + 20;
          const px = centerX + Math.cos(angle) * pRadius;
          const py = centerY + Math.sin(angle) * pRadius;
          
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, 0.6)`;
          ctx.fill();
        }
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [inputAnalyser, outputAnalyser, isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default Visualizer;