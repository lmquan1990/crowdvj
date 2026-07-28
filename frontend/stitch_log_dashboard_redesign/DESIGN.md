---
name: Cyber-Metric Console
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#b9cbc1'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#83958c'
  outline-variant: '#3a4a43'
  surface-tint: '#00e1ab'
  primary: '#fbfffa'
  on-primary: '#003828'
  primary-container: '#00ffc2'
  on-primary-container: '#007255'
  inverse-primary: '#006c50'
  secondary: '#b9f1ff'
  on-secondary: '#00363f'
  secondary-container: '#00e0ff'
  on-secondary-container: '#005f6d'
  tertiary: '#fffeff'
  on-tertiary: '#393000'
  tertiary-container: '#ffe149'
  on-tertiary-container: '#746300'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#36ffc4'
  primary-fixed-dim: '#00e1ab'
  on-primary-fixed: '#002116'
  on-primary-fixed-variant: '#00513c'
  secondary-fixed: '#a5eeff'
  secondary-fixed-dim: '#00daf8'
  on-secondary-fixed: '#001f25'
  on-secondary-fixed-variant: '#004e5a'
  tertiary-fixed: '#ffe253'
  tertiary-fixed-dim: '#e2c62e'
  on-tertiary-fixed: '#211b00'
  on-tertiary-fixed-variant: '#534600'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  log-code:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
spacing:
  base: 4px
  gutter-mobile: 16px
  gutter-desktop: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  container-padding: 20px
---

## Brand & Style
The design system establishes a high-performance, developer-centric environment for monitoring and controlling real-time logs. It adopts a **Futuristic / Cyber** aesthetic characterized by high-contrast interfaces, precision lines, and a "terminal-plus" philosophy.

The brand personality is technical, reliable, and swift. It targets engineers and system operators who require immediate clarity in data-dense environments. The UI evokes a sense of being "inside the machine"—utilizing deep blacks to eliminate distraction and neon accents to signal critical information and interactivity. The execution is disciplined and professional, avoiding cluttered "gamer" tropes in favor of functional, systematic brutalism.

## Colors
The palette is rooted in pure darkness to maximize the luminosity of the data. 

- **Primary (Neon Cyan/Green):** Used exclusively for primary actions, success states, and active status indicators. It should appear to "glow" against the black background.
- **Secondary (Electric Blue):** Used for secondary highlights, link text, and informational categorization.
- **Backgrounds:** A strict hierarchy of `Black (#000000)` for the base canvas and `Dark Gray (#121214)` for elevated cards and containers.
- **System States:** High-saturation Red and Amber are reserved for critical errors and warnings within the log stream, ensuring they break the cool-toned primary palette.

## Typography
The system employs a dual-font strategy. **Geist** provides a modern, geometric sans-serif feel for the structural UI—labels, buttons, and headers—ensuring high legibility and a professional tone. 

**JetBrains Mono** is utilized for all technical data, including the log stream, timestamps, and metadata tags. This monospaced font ensures that vertical alignment of data points remains consistent, which is critical for scanning log patterns.

On mobile devices, large headlines scale down to prevent excessive wrapping, while log text maintains a minimum of 13px to ensure readability during active debugging.

## Layout & Spacing
This design system follows a **Fluid Grid** model with high-density spacing. The layout is mobile-first, stacking all control panels and log views vertically. 

- **Mobile:** Single column with 16px horizontal safe-margins. Components occupy the full width of the viewport minus margins.
- **Desktop (1280px+):** Transitions to a multi-pane dashboard. The log stream occupies a wide central column (8 units), while control parameters and status monitors occupy a narrower side rail (4 units).
- **Rhythm:** A 4px base unit governs all dimensions. Elements are separated by "stacks" (8px, 16px, or 32px) to maintain a rigorous, systematic structure. High-density layouts are preferred to keep as much data visible as possible without scrolling.

## Elevation & Depth
Depth is created through **Tonal Layers** and **Bold Outlines** rather than traditional soft shadows. 

1.  **Level 0 (Canvas):** Pure `#000000`. Used for the global background.
2.  **Level 1 (Surface):** `#121214`. Used for cards and sections. 
3.  **Level 2 (Active/Hover):** `#1A1A1E`. Used for interactive states within cards.

Visual hierarchy is reinforced with 1px borders. Default borders use a low-contrast dark gray (`#2A2A2E`), while active or focused elements utilize the Primary Neon Cyan color. A subtle "outer glow" effect (0px 0px 8px) can be applied to primary buttons and active status indicators to simulate a hardware-LED aesthetic.

## Shapes
The design system utilizes **Sharp** (0px) roundedness for its primary aesthetic. This reinforces the brutalist, high-tech nature of the dashboard. All cards, input fields, and buttons feature 90-degree corners. 

In specific cases where secondary indicators (like status pips or small toggle icons) require differentiation, a "Soft" (0.25rem) radius may be used to indicate a "non-structural" element, but the primary interface remains strictly rectangular to mimic terminal windows and industrial rack-mount hardware.

## Components

### Buttons
- **Primary:** Solid Primary color background with Black text. 0px corner radius. High-contrast and impactful.
- **Ghost/Secondary:** 1px Primary color border with transparent background and Primary color text.
- **State:** On press, the background color shifts to a slightly darker shade or white to indicate tactile feedback.

### Input Fields
- **Terminal Style:** Background is pure black with a 1px Dark Gray border. On focus, the border changes to Primary Cyan and a subtle "scanline" texture (1px repeating pattern) can be applied to the background.
- **Font:** Use `log-code` typography for text entry.

### Cards & Sections
- Sections are delimited by 1px borders or subtle background shifts.
- Header areas of cards use `label-caps` for a technical, "readout" feel.

### Status Indicators
- Use small 8px squares (not circles) to indicate status (Online/Offline). 
- Active states use the "Glow" effect mentioned in Elevation.

### Log Stream
- Alternating row highlights (zebra striping) are disabled in favor of 1px horizontal dividers between log entries.
- Timestamps are rendered in Secondary Blue at 70% opacity to ensure the log message itself remains the primary focal point.