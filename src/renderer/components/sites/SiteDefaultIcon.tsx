import React from 'react';

interface SiteDefaultIconProps {
  className?: string;
}

const LobsterMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12.5 15c0-3.1 1.4-5 3.5-5s3.5 1.9 3.5 5v8h-7v-8Z" />
    <path d="M12 26h8" />
    <path d="M14.4 10.7C13.9 8.2 12.4 6.5 10 5.6M17.6 10.7c.5-2.5 2-4.2 4.4-5.1" />
    <path d="M12.4 16.5c-2.5 0-4.3-1.1-5.4-3.1M19.6 16.5c2.5 0 4.3-1.1 5.4-3.1" />
    <path d="M7 13.4c-2.3.6-4.2-1.2-3.8-3.6.3-1.9 2-3.2 3.8-2.9 1.4.2 2.5 1.2 2.9 2.5L7.8 9c-.8-.1-1.4.5-1.5 1.2-.1.8.4 1.5 1.2 1.7" />
    <path d="M25 13.4c2.3.6 4.2-1.2 3.8-3.6-.3-1.9-2-3.2-3.8-2.9-1.4.2-2.5 1.2-2.9 2.5l2.1-.4c.8-.1 1.4.5 1.5 1.2.1.8-.4 1.5-1.2 1.7" />
    <path d="m12.5 19-2.4 2M19.5 19l2.4 2" />
  </svg>
);

const SiteDefaultIcon: React.FC<SiteDefaultIconProps> = ({ className = '' }) => (
  <div
    className={`relative flex h-[58px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-gradient-to-br from-surface to-background shadow-sm ${className}`}
    aria-hidden="true"
  >
    <div className="absolute inset-x-0 top-0 flex h-4 items-center gap-1 border-b border-border/70 bg-background/70 px-2">
      <span className="h-1 w-1 rounded-full bg-muted/60" />
      <span className="h-1 w-1 rounded-full bg-muted/45" />
      <span className="h-1 w-1 rounded-full bg-muted/30" />
    </div>
    <div className="mt-4 flex flex-col items-center gap-1 text-primary">
      <LobsterMark className="h-7 w-7" />
      <span className="h-0.5 w-5 rounded-full bg-primary/20" />
    </div>
  </div>
);

export default SiteDefaultIcon;
