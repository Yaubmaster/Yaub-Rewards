import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutros temables (ver :root / :root[data-tema='dark'] en globals.css)
        ink: 'rgb(var(--tinta) / <alpha-value>)',
        slate2: 'rgb(var(--tinta2) / <alpha-value>)',
        slate3: 'rgb(var(--tinta3) / <alpha-value>)',
        surface: 'rgb(var(--superficie) / <alpha-value>)',
        line: 'rgb(var(--linea) / <alpha-value>)',
        // Acentos de marca: iguales en claro y oscuro
        cyan1: '#00D4FF',
        violet1: '#8B5CF6',
        green1: '#10B981',
        amber1: '#F59E0B',
      },
      backgroundImage: {
        badge: 'linear-gradient(135deg,#00D4FF,#8B5CF6)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pop: { '0%': { opacity: '0', transform: 'scale(.7)' }, '60%': { transform: 'scale(1.05)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        floatIn: { from: { opacity: '0', transform: 'translateY(-8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        fadeUp: 'fadeUp .5s ease',
        fadeUpFast: 'fadeUp .35s ease',
        pop: 'pop .6s cubic-bezier(.2,1.4,.4,1)',
        shimmer: 'shimmer 1.1s linear infinite',
        pulseDot: 'pulseDot 1.8s ease infinite',
        floatIn: 'floatIn .4s ease',
      },
    },
  },
  plugins: [],
};
export default config;
