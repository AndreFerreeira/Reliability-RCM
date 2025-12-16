import type { SVGProps } from 'react';

export function BrazilFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3" {...props}>
      <rect width="4" height="3" fill="#009B3A" />
      <path d="M2 0.3L0.3 1.5L2 2.7L3.7 1.5L2 0.3Z" fill="#FFCC29" />
      <circle cx="2" cy="1.5" r="0.5" fill="#002776" />
    </svg>
  );
}

export function UKFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" {...props}>
      <clipPath id="a">
        <path d="M0 0h60v30H0z" />
      </clipPath>
      <g clipPath="url(#a)">
        <path d="M0 0h60v30H0z" fill="#012169" />
        <path
          d="M0 0l60 30m0-30L0 30"
          stroke="#fff"
          strokeWidth="6"
        />
        <path
          d="M0 0l60 30m0-30L0 30"
          stroke="#C8102E"
          strokeWidth="4"
        />
        <path d="M-1 15h62M30-1v32" stroke="#fff" strokeWidth="10" />
        <path d="M-1 15h62M30-1v32" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

export function SpainFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2" {...props}>
      <path fill="#C60B1E" d="M0 0h3v2H0z" />
      <path fill="#FFC400" d="M0 0.5h3v1H0z" />
    </svg>
  );
}
