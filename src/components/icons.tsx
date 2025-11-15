import type { SVGProps } from "react";

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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="hsl(var(--primary))" stroke="hsl(var(--primary))"/>
      <path d="m7.5 15.5 3-3 2 2 3.5-3.5" stroke="hsl(var(--background))" strokeWidth="1.5"/>
    </svg>
  );
}
