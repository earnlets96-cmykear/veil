import { DeviceMediaItem } from '../../../media/NativeDeviceMediaBridge.ts';

// High-fidelity SVG thumbnails representing the 6 curated reference gallery scenes from Image 2
const svgBlueprint = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="bgDraft" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#2a3342" />
        <stop offset="100%" stop-color="#181e29" />
      </linearGradient>
      <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#e2e8f0" />
        <stop offset="100%" stop-color="#cbd5e1" />
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#bgDraft)" />
    <!-- Drafting table with large architectural blueprint -->
    <rect x="30" y="50" width="340" height="300" rx="8" fill="url(#paper)" transform="rotate(-2 200 200)" />
    <!-- Blueprint grid lines & floor plan -->
    <g stroke="#3b82f6" stroke-width="1.5" fill="none" opacity="0.75">
      <rect x="50" y="70" width="300" height="260" stroke-dasharray="4,4" />
      <rect x="80" y="100" width="100" height="120" />
      <rect x="200" y="100" width="130" height="80" />
      <rect x="200" y="195" width="130" height="110" />
      <line x1="80" y1="160" x2="180" y2="160" />
      <line x1="140" y1="100" x2="140" y2="220" />
      <circle cx="130" cy="270" r="28" stroke-dasharray="2,2" />
    </g>
    <!-- Drafting tools: ruler, compass, pencil -->
    <g fill="#475569" opacity="0.85">
      <rect x="60" y="320" width="220" height="14" rx="2" fill="#94a3b8" />
      <polygon points="310,290 325,320 295,320" fill="#64748b" />
    </g>
    <!-- Architectural designer silhouette -->
    <circle cx="200" cy="40" r="18" fill="#334155" />
    <path d="M160,95 Q200,65 240,95 L230,130 L170,130 Z" fill="#1e293b" opacity="0.9" />
  </svg>`
)}`;

const svgModernOffice = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="bgOffice" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f8fafc" />
        <stop offset="100%" stop-color="#e2e8f0" />
      </linearGradient>
      <linearGradient id="woodTable" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#d97706" />
        <stop offset="100%" stop-color="#b45309" />
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#bgOffice)" />
    <!-- Large studio windows with daylight -->
    <rect x="20" y="30" width="100" height="200" rx="4" fill="#bae6fd" opacity="0.6" stroke="#94a3b8" stroke-width="2" />
    <rect x="135" y="30" width="100" height="200" rx="4" fill="#bae6fd" opacity="0.6" stroke="#94a3b8" stroke-width="2" />
    <!-- Long communal wooden work table -->
    <polygon points="50,220 350,220 380,330 20,330" fill="url(#woodTable)" opacity="0.9" />
    <!-- Dual monitors & laptops -->
    <rect x="80" y="160" width="55" height="40" rx="3" fill="#1e293b" />
    <rect x="103" y="200" width="10" height="20" fill="#64748b" />
    <rect x="175" y="155" width="60" height="42" rx="3" fill="#1e293b" />
    <rect x="200" y="197" width="10" height="23" fill="#64748b" />
    <rect x="270" y="165" width="50" height="35" rx="3" fill="#1e293b" />
    <rect x="290" y="200" width="10" height="20" fill="#64748b" />
    <!-- Lush indoor potted plants -->
    <g fill="#15803d">
      <ellipse cx="45" cy="180" rx="22" ry="35" opacity="0.8" />
      <ellipse cx="365" cy="190" rx="25" ry="40" opacity="0.8" />
    </g>
    <!-- Hanging industrial pendant ceiling lamps -->
    <line x1="120" y1="0" x2="120" y2="70" stroke="#475569" stroke-width="2" />
    <path d="M105,70 L135,70 L140,85 L100,85 Z" fill="#334155" />
    <line x1="260" y1="0" x2="260" y2="70" stroke="#475569" stroke-width="2" />
    <path d="M245,70 L275,70 L280,85 L240,85 Z" fill="#334155" />
  </svg>`
)}`;

const svgDeskSetup = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="wallBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1e1b18" />
        <stop offset="100%" stop-color="#322e2b" />
      </linearGradient>
      <linearGradient id="deskWood" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#854d0e" />
        <stop offset="100%" stop-color="#713f12" />
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#wallBg)" />
    <!-- Minimalist warm wooden desk -->
    <rect x="0" y="260" width="400" height="140" fill="url(#deskWood)" />
    <!-- Desk mat / blotter -->
    <rect x="40" y="275" width="320" height="110" rx="8" fill="#18181b" opacity="0.85" />
    <!-- Laptop on wooden riser stand -->
    <rect x="135" y="240" width="130" height="15" rx="3" fill="#a16207" />
    <rect x="130" y="130" width="140" height="95" rx="5" fill="#0f172a" stroke="#334155" stroke-width="2" />
    <rect x="140" y="140" width="120" height="75" rx="2" fill="#0284c7" opacity="0.3" />
    <polygon points="120,230 280,230 270,240 130,240" fill="#475569" />
    <!-- Compact mechanical keyboard -->
    <rect x="130" y="300" width="140" height="50" rx="6" fill="#27272a" stroke="#52525b" stroke-width="1.5" />
    <!-- Keycaps grid representation -->
    <g fill="#71717a">
      <rect x="138" y="306" width="14" height="10" rx="1.5" />
      <rect x="156" y="306" width="14" height="10" rx="1.5" />
      <rect x="174" y="306" width="14" height="10" rx="1.5" />
      <rect x="192" y="306" width="14" height="10" rx="1.5" />
      <rect x="210" y="306" width="14" height="10" rx="1.5" />
      <rect x="228" y="306" width="14" height="10" rx="1.5" />
      <rect x="246" y="306" width="16" height="10" rx="1.5" fill="#f97316" />
    </g>
    <!-- Coffee mug and notebook -->
    <circle cx="85" cy="330" r="18" fill="#e4e4e7" />
    <rect x="300" y="290" width="45" height="65" rx="4" fill="#a8a29e" />
  </svg>`
)}`;

const svgModernVilla = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#93c5fd" />
        <stop offset="100%" stop-color="#dbeafe" />
      </linearGradient>
      <linearGradient id="poolGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0284c7" />
        <stop offset="100%" stop-color="#0369a1" />
      </linearGradient>
    </defs>
    <!-- Sky -->
    <rect width="400" height="230" fill="url(#skyGrad)" />
    <!-- Lawn and landscaped gravel ground -->
    <rect x="0" y="230" width="400" height="170" fill="#166534" />
    <polygon points="0,290 400,290 400,400 0,400" fill="#e2e8f0" />
    <!-- Architectural cubic villa structure -->
    <rect x="50" y="90" width="280" height="150" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" />
    <!-- Floor-to-ceiling glass panoramic windows -->
    <rect x="70" y="110" width="115" height="120" fill="#38bdf8" opacity="0.45" stroke="#0284c7" stroke-width="1.5" />
    <rect x="195" y="110" width="115" height="120" fill="#38bdf8" opacity="0.45" stroke="#0284c7" stroke-width="1.5" />
    <!-- Upper terrace cantilever balcony -->
    <rect x="35" y="80" width="310" height="16" fill="#334155" />
    <!-- Infinity reflecting pool in foreground -->
    <polygon points="70,300 330,300 360,385 40,385" fill="url(#poolGrad)" opacity="0.85" />
    <!-- Subtle trees & architectural foliage -->
    <g fill="#15803d" opacity="0.9">
      <ellipse cx="30" cy="210" rx="20" ry="40" />
      <ellipse cx="370" cy="200" rx="25" ry="45" />
    </g>
  </svg>`
)}`;

const svgNightCityscape = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="nightSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="60%" stop-color="#1e1b4b" />
        <stop offset="100%" stop-color="#312e81" />
      </linearGradient>
      <linearGradient id="waterReflect" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1e1b4b" />
        <stop offset="100%" stop-color="#030712" />
      </linearGradient>
    </defs>
    <!-- Night Sky -->
    <rect width="400" height="260" fill="url(#nightSky)" />
    <!-- Moon / City glow -->
    <circle cx="330" cy="70" r="22" fill="#fef08a" opacity="0.85" />
    <!-- City Skyscrapers Silhouette with glowing windows -->
    <rect x="25" y="110" width="55" height="150" fill="#0f172a" />
    <rect x="90" y="70" width="70" height="190" fill="#1e293b" />
    <!-- Empire-style tower spire -->
    <polygon points="125,20 128,70 122,70" fill="#f59e0b" />
    <rect x="170" y="130" width="60" height="130" fill="#0f172a" />
    <rect x="240" y="90" width="75" height="170" fill="#1e293b" />
    <rect x="325" y="140" width="55" height="120" fill="#0f172a" />
    <!-- Glowing window dots -->
    <g fill="#fef08a" opacity="0.85">
      <rect x="100" y="85" width="6" height="8" /><rect x="115" y="85" width="6" height="8" /><rect x="130" y="85" width="6" height="8" />
      <rect x="100" y="110" width="6" height="8" /><rect x="130" y="110" width="6" height="8" />
      <rect x="100" y="140" width="6" height="8" /><rect x="115" y="140" width="6" height="8" />
      <rect x="255" y="105" width="6" height="8" /><rect x="275" y="105" width="6" height="8" /><rect x="295" y="105" width="6" height="8" />
      <rect x="255" y="130" width="6" height="8" /><rect x="295" y="130" width="6" height="8" />
      <rect x="40" y="135" width="6" height="8" /><rect x="55" y="135" width="6" height="8" />
    </g>
    <!-- Waterfront with light trails and reflections -->
    <rect x="0" y="260" width="400" height="140" fill="url(#waterReflect)" />
    <!-- Highway traffic light streaks -->
    <path d="M0,265 Q200,280 400,265" stroke="#ef4444" stroke-width="4" fill="none" opacity="0.9" />
    <path d="M0,272 Q200,288 400,272" stroke="#fbbf24" stroke-width="5" fill="none" opacity="0.95" />
    <!-- Water reflections -->
    <ellipse cx="125" cy="320" rx="35" ry="8" fill="#f59e0b" opacity="0.3" />
    <ellipse cx="275" cy="330" rx="40" ry="9" fill="#fef08a" opacity="0.3" />
  </svg>`
)}`;

const svgTechSketch = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="sketchbookBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fdfbf7" />
        <stop offset="100%" stop-color="#ece7de" />
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#sketchbookBg)" />
    <!-- Spiral binder rings on left -->
    <g fill="#94a3b8">
      <circle cx="20" cy="40" r="6" /><circle cx="20" cy="80" r="6" /><circle cx="20" cy="120" r="6" />
      <circle cx="20" cy="160" r="6" /><circle cx="20" cy="200" r="6" /><circle cx="20" cy="240" r="6" />
      <circle cx="20" cy="280" r="6" /><circle cx="20" cy="320" r="6" /><circle cx="20" cy="360" r="6" />
    </g>
    <!-- Technical cylindrical product / smart speaker drawing -->
    <g stroke="#1e293b" stroke-width="2" fill="none" opacity="0.85">
      <!-- Outer cylindrical shell -->
      <ellipse cx="200" cy="120" rx="65" ry="25" fill="#e2e8f0" stroke-width="2.5" />
      <line x1="135" y1="120" x2="135" y2="270" stroke-width="2.5" />
      <line x1="265" y1="120" x2="265" y2="270" stroke-width="2.5" />
      <path d="M135,270 A65,25 0 0,0 265,270" stroke-width="2.5" fill="#cbd5e1" />
      <!-- Inner acoustic grill textures -->
      <ellipse cx="200" cy="170" rx="58" ry="20" stroke-dasharray="3,3" opacity="0.6" />
      <ellipse cx="200" cy="220" rx="58" ry="20" stroke-dasharray="3,3" opacity="0.6" />
      <!-- Top capacitive control ring -->
      <circle cx="200" cy="120" r="18" fill="#94a3b8" opacity="0.5" />
      <line x1="190" y1="120" x2="210" y2="120" stroke-width="3" />
      <!-- Dimension callouts & notes -->
      <line x1="85" y1="120" x2="115" y2="120" stroke="#64748b" stroke-dasharray="2,2" />
      <line x1="85" y1="270" x2="115" y2="270" stroke="#64748b" stroke-dasharray="2,2" />
      <line x1="95" y1="120" x2="95" y2="270" stroke="#0284c7" stroke-width="1.5" />
      <text x="70" y="200" font-size="12" font-family="monospace" fill="#0284c7" transform="rotate(-90 70 200)">148mm</text>
    </g>
    <!-- Technical drafting fineliner pen -->
    <g transform="rotate(25 320 310)" opacity="0.9">
      <rect x="310" y="160" width="14" height="150" rx="3" fill="#09090b" />
      <polygon points="310,310 324,310 317,330" fill="#71717a" />
      <rect x="316" y="330" width="2" height="10" fill="#0284c7" />
    </g>
  </svg>`
)}`;

export const SAMPLE_GALLERY_MEDIA: DeviceMediaItem[] = [
  {
    uri: 'veil://sample/arch_blueprints',
    name: 'blueprint_plan.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1845200,
    thumbnailDataUrl: svgBlueprint,
  },
  {
    uri: 'veil://sample/modern_office',
    name: 'team_workspace.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 2410800,
    thumbnailDataUrl: svgModernOffice,
  },
  {
    uri: 'veil://sample/workspace_desk',
    name: 'minimal_desk.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1532000,
    thumbnailDataUrl: svgDeskSetup,
  },
  {
    uri: 'veil://sample/modern_villa',
    name: 'luxury_villa.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 3102400,
    thumbnailDataUrl: svgModernVilla,
  },
  {
    uri: 'veil://sample/night_cityscape',
    name: 'city_skyline.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 2894100,
    thumbnailDataUrl: svgNightCityscape,
  },
  {
    uri: 'veil://sample/tech_sketch',
    name: 'product_sketch.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1145600,
    thumbnailDataUrl: svgTechSketch,
  },
];

/**
 * Converts a sample media item into an in-memory File blob for staging and Double Ratchet dispatch.
 */
export function sampleMediaToFile(item: DeviceMediaItem): File {
  const dataUrl = item.thumbnailDataUrl || '';
  const match = dataUrl.match(/^data:([^;]+);utf8,(.*)$/);
  if (match) {
    const mime = match[1];
    const content = decodeURIComponent(match[2]);
    const blob = new Blob([content], { type: mime });
    return new File([blob], item.name, { type: item.mimeType });
  }

  // Fallback synthetic file content
  const syntheticContent = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  return new File([syntheticContent], item.name, { type: item.mimeType });
}
