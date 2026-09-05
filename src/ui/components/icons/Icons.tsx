/**
 * VEIL Vector Icon System — Clean, Scalable 24x24 Stroke SVG Icons.
 * Zero-dependency, theme-inheriting, accessible icon primitives.
 */

import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  color?: string;
  strokeWidth?: number;
}

const defaultProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// -----------------------------------------------------------------------------
// Security & Authentication Icons
// -----------------------------------------------------------------------------

export const ShieldIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const LockIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const UnlockIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

export const KeyIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="m21 2-2 2m-1.5 1.5L14 9l-1.5-1.5-2 2L12 11l-3 3a5 5 0 1 1-7-7l3-3 1.5 1.5 2-2L7 2l3.5-3.5" />
    <circle cx="7.5" cy="16.5" r="1.5" />
  </svg>
);

export const EyeIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// -----------------------------------------------------------------------------
// Messaging & Communication Icons
// -----------------------------------------------------------------------------

export const SendIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export const PaperclipIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

export const MicIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

export const MicOffIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.68-1.33" />
    <path d="M19 10v2a7 7 0 0 1-11.75 5.17" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

export const StopIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill={color || 'currentColor'} />
  </svg>
);

export const PlayIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <polygon points="5 3 19 12 5 21 5 3" fill={color || 'currentColor'} stroke="none" />
  </svg>
);

export const PauseIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <rect x="6" y="4" width="4" height="16" fill={color || 'currentColor'} stroke="none" />
    <rect x="14" y="4" width="4" height="16" fill={color || 'currentColor'} stroke="none" />
  </svg>
);

// -----------------------------------------------------------------------------
// Media & File Icons
// -----------------------------------------------------------------------------

export const ImageIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

export const VideoIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

export const FileIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export const FileTextIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export const FilePdfIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9 15v-4h2a1.5 1.5 0 0 1 0 3H9" />
  </svg>
);

export const FileZipIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M10 11h2m-2 3h2m-2-6h2m-1 9v2" />
  </svg>
);

export const FileAudioIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <circle cx="10" cy="16" r="2" />
    <path d="M12 16V11l4-1v5" />
  </svg>
);

export const DownloadIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const UploadIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export const ShareIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

// -----------------------------------------------------------------------------
// Navigation & Controls
// -----------------------------------------------------------------------------

export const SearchIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const UserIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const UsersIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const MoreVerticalIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <circle cx="12" cy="12" r="1" fill={color || 'currentColor'} />
    <circle cx="12" cy="5" r="1" fill={color || 'currentColor'} />
    <circle cx="12" cy="19" r="1" fill={color || 'currentColor'} />
  </svg>
);

export const MoreHorizontalIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <circle cx="12" cy="12" r="1" fill={color || 'currentColor'} />
    <circle cx="5" cy="12" r="1" fill={color || 'currentColor'} />
    <circle cx="19" cy="12" r="1" fill={color || 'currentColor'} />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const ArrowLeftIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const CheckCheckIcon: React.FC<IconProps> = ({ size = 16, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M18 6 7 17l-5-5" />
    <path d="m22 10-7.5 7.5L13 16" />
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size = 16, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const RefreshCwIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export const MenuIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const ReplyIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <polyline points="9 17 4 12 9 7" />
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
);

export const ForwardIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <polyline points="15 17 20 12 15 7" />
    <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
  </svg>
);

export const GridIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

export const ZoomInIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

export const ZoomOutIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

export const MaximizeIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);

export const MinimizeIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
  </svg>
);

export const VolumeIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

export const VolumeXIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

export const AlertCircleIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export const InfoIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export const CheckCircleIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const ExternalLinkIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const SunIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

export const MoonIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export const FolderIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const UserPlusIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

export const CameraIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export const PhoneIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export const MessageSquareIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const BellIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export const BellOffIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
    <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
    <path d="M18 8a6 6 0 0 0-9.33-5" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export const QrCodeIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="5" y="5" width="3" height="3" fill={color || 'currentColor'} stroke="none" />
    <rect x="16" y="5" width="3" height="3" fill={color || 'currentColor'} stroke="none" />
    <rect x="5" y="16" width="3" height="3" fill={color || 'currentColor'} stroke="none" />
    <line x1="14" y1="14" x2="14" y2="14.01" />
    <line x1="14" y1="17" x2="17" y2="17" />
    <line x1="17" y1="14" x2="21" y2="14" />
    <line x1="21" y1="17" x2="21" y2="21" />
    <line x1="14" y1="21" x2="17" y2="21" />
  </svg>
);

export const LinkIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

export const EditIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export const DeleteIcon: React.FC<IconProps> = ({ size = 20, className = '', color, strokeWidth = 2, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} strokeWidth={strokeWidth} className={`veil-icon ${className}`.trim()} {...props}>
    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
    <line x1="18" y1="9" x2="12" y2="15" />
    <line x1="12" y1="9" x2="18" y2="15" />
  </svg>
);


