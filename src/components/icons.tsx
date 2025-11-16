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

export function BathtubCurveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity="0.3" />
          <stop offset="25%" stopColor="hsl(var(--chart-2))" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
          <stop offset="50%" stopColor="hsl(var(--chart-1))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity="0" />
          <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Axis */}
      <path d="M 10 90 H 190" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
      <path d="M 10 90 V 10" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />

      {/* Axis Labels */}
      <text x="100" y="98" textAnchor="middle" fontSize="5" fill="hsl(var(--muted-foreground))">Tempo</text>
      <text x="5" y="50" textAnchor="middle" transform="rotate(-90 5 50)" fontSize="5" fill="hsl(var(--muted-foreground))">Taxa de Falha</text>

      {/* Zones */}
      <rect x="10" y="10" width="40" height="80" fill="url(#grad1)" />
      <rect x="50" y="10" width="80" height="80" fill="url(#grad2)" />
      <rect x="130" y="10" width="60" height="80" fill="url(#grad3)" />

      {/* Bathtub Curve */}
      <path d="M 20 20 Q 40 75, 70 75 T 140 75 Q 170 75, 180 30" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" />
      
      {/* Zone Labels */}
      <text x="30" y="20" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))">Mortalidade Infantil</text>
      <text x="90" y="40" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))">Vida Útil</text>
      <text x="160" y="30" textAnchor="middle" fontSize="6" fill="hsl(var(--foreground))">Desgaste</text>
    </svg>
  );
}

export function PFCurveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Axis */}
      <path d="M 10 90 H 195" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
      <path d="M 10 90 V 5" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
      <text x="100" y="98" textAnchor="middle" fontSize="5" fill="hsl(var(--muted-foreground))">Tempo de Operação</text>
      <text x="5" y="45" textAnchor="middle" transform="rotate(-90 5 45)" fontSize="5" fill="hsl(var(--muted-foreground))">Performance</text>

      {/* Color Zones */}
      <path d="M 10 20 H 50 Q 120 20 190 90 H 10 V 20 Z" fill="hsl(var(--chart-2) / 0.3)" />
      <path d="M 50 20 H 100 Q 135 20 190 90 H 50 V 20 Z" fill="hsl(var(--chart-4) / 0.3)" />
      <path d="M 100 20 H 100 Q 135 20 190 90 H 100 V 20 Z" fill="hsl(var(--destructive) / 0.3)" />

      {/* PF Curve */}
      <path d="M 10 20 H 50 Q 120 20 190 90" stroke="hsl(var(--foreground))" strokeWidth="1.5" fill="none" />
      
      {/* P and F points */}
      <circle cx="50" cy="20" r="1.5" fill="hsl(var(--destructive))" />
      <text x="50" y="15" textAnchor="middle" fontSize="5" fill="hsl(var(--destructive))">P</text>
      <circle cx="190" cy="90" r="1.5" fill="hsl(var(--destructive))" />
      <text x="193" y="88" textAnchor="start" fontSize="5" fill="hsl(var(--destructive))">F</text>
      
      {/* Detection points */}
      <circle cx="30" cy="20" r="1" fill="hsl(var(--primary))" />
      <text x="30" y="15" textAnchor="middle" fontSize="4" fill="hsl(var(--muted-foreground))">Início da Falha</text>

      <circle cx="65" cy="21" r="1" fill="hsl(var(--primary))" />
      <text x="65" y="16" textAnchor="middle" fontSize="4" fill="hsl(var(--muted-foreground))">Ultrassom</text>
      
      <circle cx="85" cy="23" r="1" fill="hsl(var(--primary))" />
      <text x="85" y="18" textAnchor="middle" fontSize="4" fill="hsl(var(--muted-foreground))">Vibração</text>

      <circle cx="110" cy="28" r="1" fill="hsl(var(--primary))" />
      <text x="110" y="23" textAnchor="middle" fontSize="4" fill="hsl(var(--muted-foreground))">Ruído</text>
      
      {/* Zone Labels */}
      <text x="30" y="80" textAnchor="middle" fontSize="6" fill="hsl(var(--chart-2))">Preditiva</text>
      <text x="75" y="80" textAnchor="middle" fontSize="6" fill="hsl(var(--chart-4))">Preventiva</text>
      <text x="145" y="80" textAnchor="middle" fontSize="6" fill="hsl(var(--destructive))">Corretiva</text>
      
      {/* PF Interval */}
      <path d="M 50 92 V 94 H 190 V 92" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" fill="none" />
      <text x="120" y="98" textAnchor="middle" fontSize="5" fill="hsl(var(--muted-foreground))">Intervalo P-F</text>
    </svg>
  );
}