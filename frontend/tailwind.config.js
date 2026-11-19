/** @type {import('tailwindcss').Config} */

// ZorTech brand (from the company overview deck): orange #F7911E, navy #1A4277.
const navy = {
  50: '#EEF3FA',
  100: '#DCE6F4',
  200: '#B8CCE8',
  300: '#8AA9D6',
  400: '#5781BE',
  500: '#2F5FA3',
  600: '#1A4277', // primary
  700: '#15365F',
  800: '#0F2A4F', // sidebar
  900: '#0A1D37',
  950: '#061325',
};

const brand = {
  50: '#FFF6EB',
  100: '#FFE8CC',
  200: '#FFD199',
  300: '#FDB662',
  400: '#FBA23E',
  500: '#F7911E', // logo orange
  600: '#E07B0A',
  700: '#B85F00',
  800: '#8F4A05',
  900: '#6E3A08',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy,
        brand,
        // Existing screens use Tailwind "blue" for primary actions, links and
        // focus rings (~660 places). Pointing it at the brand navy re-themes
        // them in one place.
        blue: navy,
        ink: { DEFAULT: '#262626', soft: '#3D4651' },
        muted: '#5F6B76',
        line: { DEFAULT: '#E3E7EC', strong: '#CBD2DA' },
        surface: { DEFAULT: '#F6F8FB', raised: '#FFFFFF', sunken: '#EEF1F5' },
        success: { 50: '#ECF8F0', 600: '#1C7A43', 700: '#16623A' },
        warning: { 50: '#FFF6EB', 600: '#B85F00', 700: '#8F4A05' },
        danger: { 50: '#FEF1F0', 600: '#C0352B', 700: '#9B2920' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Poppins', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        pop: '0 12px 32px -8px rgba(15, 42, 79, 0.25)',
      },
      ringColor: {
        DEFAULT: '#1A4277',
      },
    },
  },
  plugins: [],
};
