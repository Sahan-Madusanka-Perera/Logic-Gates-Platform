import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P) {
  // Decorative by default; an icon given an aria-label becomes a labelled image.
  const labelled = rest['aria-label'] !== undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? 'img' : undefined}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconLearn = (p: P) => (
  <Svg {...p}>
    <path d="M3 5.5c3-1.3 6-1.3 9 .5 3-1.8 6-1.8 9-.5v13c-3-1.3-6-1.3-9 .5-3-1.8-6-1.8-9-.5z" />
    <path d="M12 6v13" />
  </Svg>
);
export const IconLab = (p: P) => (
  <Svg {...p}>
    <path d="M4 8h5a5 5 0 0 1 0 10H4z" />
    <path d="M1.5 11h2.5M1.5 15h2.5M14 13h3" />
    <circle cx="19.5" cy="13" r="2.5" />
  </Svg>
);
export const IconPractice = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </Svg>
);
export const IconExam = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5M9.5 2.5h5" />
  </Svg>
);
export const IconProgress = (p: P) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);
export const IconSun = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);
export const IconMoon = (p: P) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
  </Svg>
);
export const IconX = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconHint = (p: P) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" />
  </Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const IconArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const IconReset = (p: P) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
);
export const IconUndo = (p: P) => (
  <Svg {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Svg>
);
export const IconRedo = (p: P) => (
  <Svg {...p}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Svg>
);
export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M7 4.5v15l12-7.5z" />
  </Svg>
);
export const IconStep = (p: P) => (
  <Svg {...p}>
    <path d="M5 5v14l9-7zM18 5v14" />
  </Svg>
);
export const IconTable = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M3 14h18M9 4v16" />
  </Svg>
);
export const IconFlag = (p: P) => (
  <Svg {...p}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Svg>
);
export const IconOffline = (p: P) => (
  <Svg {...p}>
    <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.2-1.6M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5" />
    <circle cx="12" cy="20" r="0.8" fill="currentColor" />
  </Svg>
);
export const IconSpark = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
  </Svg>
);
export const IconWarn = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l9.5 17h-19z" />
    <path d="M12 10v4M12 17.2v.3" />
  </Svg>
);
export const IconMenu = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconZoomIn = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-5-5M11 8v6M8 11h6" />
  </Svg>
);
export const IconZoomOut = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-5-5M8 11h6" />
  </Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M4 20h16" />
  </Svg>
);
export const IconUpload = (p: P) => (
  <Svg {...p}>
    <path d="M12 16V5M7 10l5-5 5 5M4 20h16" />
  </Svg>
);

/** Brand mark: an AND gate whose output is lit. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="0" y="0" width="32" height="32" rx="8" fill="var(--ink)" />
      <path d="M8 8h7.5a8 8 0 0 1 0 16H8z" fill="none" stroke="var(--paper)" strokeWidth="2.2" />
      <path d="M4 12.5h4M4 19.5h4" stroke="var(--paper)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M23.5 16h3" stroke="var(--hi)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="27.5" cy="16" r="2.2" fill="var(--hi)" />
    </svg>
  );
}
