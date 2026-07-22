import React from 'react';

interface SidebarSitesIconProps {
  className?: string;
}

const SidebarSitesIcon: React.FC<SidebarSitesIconProps> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <rect
      x="2.25"
      y="3.25"
      width="15.5"
      height="13.5"
      rx="2.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M2.75 7h14.5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="5" cy="5.2" r=".7" fill="currentColor" />
    <circle cx="7.3" cy="5.2" r=".7" fill="currentColor" opacity=".55" />
    <path d="M7 11.75h6M8.5 14h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export default SidebarSitesIcon;
