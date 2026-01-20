/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      maxWidth: {
        // Custom max-width for ultrawide monitor support
        'ultrawide': '2560px',
        'video': '1200px',
      },
      colors: {
        // SeeZee Clip Studios Brand Tokens
        sz: {
          // Backgrounds
          bg: {
            DEFAULT: '#0D1117',     // Primary background (dark navy)
            secondary: '#161B22',   // Panel backgrounds
            tertiary: '#1C2128',    // Elevated surfaces
            hover: '#21262D',       // Hover states
          },
          // Borders
          border: {
            DEFAULT: '#21262D',     // Subtle borders
            light: '#30363D',       // Lighter borders
            focus: '#DC2626',       // Focus states
          },
          // Accent colors (SeeZee Red)
          accent: {
            DEFAULT: '#DC2626',     // SeeZee red
            hover: '#EF4444',       // Hover state
            muted: '#DC262620',     // Muted accent for backgrounds
            glow: '#DC262630',      // Glow effect
          },
          // Text colors
          text: {
            DEFAULT: '#FAFAFA',     // Primary text
            secondary: '#888888',   // Secondary text
            muted: '#555555',       // Muted text
            inverse: '#0A0A0A',     // Text on accent
          },
          // Semantic colors
          success: {
            DEFAULT: '#22C55E',
            muted: '#22C55E20',
          },
          danger: {
            DEFAULT: '#EF4444',
            muted: '#EF444420',
          },
          warning: {
            DEFAULT: '#F59E0B',
            muted: '#F59E0B20',
          },
          // Pattern colors for timeline segments
          pattern: {
            payoff: '#00D9FF',
            'payoff-muted': '#00D9FF30',
            monologue: '#A855F7',
            'monologue-muted': '#A855F730',
            laughter: '#FACC15',
            'laughter-muted': '#FACC1530',
            debate: '#F97316',
            'debate-muted': '#F9731630',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        'sz': '6px',
        'sz-lg': '8px',
      },
      boxShadow: {
        'sz-glow': '0 0 20px rgba(220, 38, 38, 0.15)',
        'sz-glow-lg': '0 0 40px rgba(220, 38, 38, 0.2)',
        'sz-float': '0 8px 30px rgba(0, 0, 0, 0.5)',
        'sz-card': '0 2px 8px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'sz-pulse': 'szPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'sz-fade-in': 'szFadeIn 150ms ease-out',
        'sz-slide-up': 'szSlideUp 200ms ease-out',
        'sz-slide-in-right': 'szSlideInRight 200ms ease-out',
      },
      keyframes: {
        szPulse: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.7 },
        },
        szFadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        szSlideUp: {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        szSlideInRight: {
          '0%': { opacity: 0, transform: 'translateX(20px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
      },
      transitionDuration: {
        'sz-fast': '100ms',
        'sz-normal': '150ms',
        'sz-slow': '200ms',
      },
    },
  },
  plugins: [],
}
