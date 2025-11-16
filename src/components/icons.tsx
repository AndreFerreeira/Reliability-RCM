import type { SVGProps } from "react";
import { LineChart, Bot, BrainCircuit } from 'lucide-react';

export { LineChart, Bot, BrainCircuit };

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="hsl(var(--accent) / 0.2)" stroke="hsl(var(--accent))"/>
      <path d="m7.5 15.5 3-3 2 2 3.5-3.5" stroke="hsl(var(--accent-foreground))" strokeWidth="1.5"/>
    </svg>
  );
}

// Illustrative charts for Decision Assistant

export function ReliabilityZoneChart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Zones */}
      <rect x="10" y="10" width="85" height="20" fill="#a3be8c" fillOpacity="0.6" />
      <rect x="10" y="30" width="85" height="20" fill="#ebcb8b" fillOpacity="0.6" />
      <rect x="10" y="50" width="85" height="20" fill="#bf616a" fillOpacity="0.6" />
      
      {/* Axes */}
      <path d="M10 70 L10 10 L95 10" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
      <path d="M10 70 L95 70" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
      
      {/* Curve */}
      <path d="M12,15 C 30,25 50,45 90,65" stroke="#5e81ac" strokeWidth="1.5" fill="none" />
      
      {/* Dashed Line */}
      <path d="M40 54 L 40 70" stroke="hsl(var(--foreground))" strokeWidth="0.5" strokeDasharray="2 2" />
      
      {/* Text */}
      <text x="52.5" y="22" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">Zona econômica</text>
      <text x="52.5" y="27" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">de operação</text>
      <text x="52.5" y="42" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">Zona de</text>
      <text x="52.5" y="47" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">atenção</text>
      <text x="52.5" y="62" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">Zona de</text>
      <text x="52.5" y="67" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">falha cara</text>
    </svg>
  );
}

export function FailureProbabilityZoneChart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Fill Path */}
      <path d="M10,65 C 30,55 50,35 90,15 L 90,70 L 10,70 Z" fill="#d08770" fillOpacity="0.4" />
      
      {/* Zones */}
      <rect x="10" y="10" width="85" height="20" fill="#a3be8c" fillOpacity="0.6" />
      <rect x="10" y="30" width="85" height="20" fill="#ebcb8b" fillOpacity="0.6" />
      <rect x="10" y="50" width="85" height="20" fill="#bf616a" fillOpacity="0.6" />
      
      {/* Axes */}
      <path d="M10 70 L10 10 L95 10" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
      <path d="M10 70 L95 70" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
      
      {/* Curve */}
      <path d="M12,65 C 30,55 50,35 90,15" stroke="#d08770" strokeWidth="1.5" fill="none" />
      
      {/* Text */}
      <text x="52.5" y="22" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">Zona econômica</text>
      <text x="52.5" y="27" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">de operação</text>
      <text x="52.5" y="42" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">Zona de</text>
      <text x="52.5" y="47" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">atenção</text>
    </svg>
  );
}

export function ProbabilityDensityZoneChart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Zones */}
      <rect x="10" y="10" width="85" height="20" fill="#a3be8c" fillOpacity="0.6" />
      <rect x="10" y="30" width="85" height="20" fill="#ebcb8b" fillOpacity="0.6" />
      <rect x="10" y="50" width="85" height="20" fill="#bf616a" fillOpacity="0.6" />
      
      {/* Axes */}
      <path d="M10 70 L10 10 L95 10" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
      <path d="M10 70 L95 70" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
      
      {/* Curve */}
      <path d="M15,68 C 30,15 70,15 85,68" stroke="#ebcb8b" strokeWidth="1.5" fill="none" />
      
      {/* Text */}
      <text x="30" y="22" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">Zona econômica</text>
      <text x="30" y="27" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">de operação</text>
      <text x="70" y="42" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">Zona de</text>
      <text x="70" y="47" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">atenção</text>
      <text x="50" y="62" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">Zona de</text>
      <text x="50" y="67" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">falha cara</text>
    </svg>
  );
}

export function WeibullZoneChart(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" {...props}>
            {/* Zones */}
            <rect x="10" y="10" width="85" height="20" fill="#a3be8c" fillOpacity="0.6" />
            <rect x="10" y="30" width="85" height="20" fill="#ebcb8b" fillOpacity="0.6" />
            <rect x="10" y="50" width="85" height="20" fill="#bf616a" fillOpacity="0.6" />
            
            {/* Axes */}
            <path d="M10 70 L10 10 L95 10" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
            <path d="M10 70 L95 70" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
            
            {/* Lines */}
            <line x1="20" y1="70" x2="90" y2="10" stroke="#5e81ac" strokeWidth="1.5" />
            <line x1="10" y1="60" x2="70" y2="30" stroke="#d08770" strokeWidth="1.5" />
            
            {/* Text */}
            <text x="52.5" y="22" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">Zona econômica</text>
            <text x="52.5" y="27" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">de operação</text>
            <text x="52.5" y="42" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">Zona de</text>
            <text x="52.5" y="47" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">falha cara</text>
            <text x="30" y="62" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">Parar</text>
            <text x="75" y="55" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">Escolher</text>
            <text x="75" y="60" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))" fontWeight="bold">maior η e β</text>
        </svg>
    );
}
