/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { game: ['"Baloo 2"', 'system-ui', 'sans-serif'] },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '60%': { transform: 'scale(1.06)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        slideDown: { '0%': { transform: 'translateY(-40px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        shine: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: {
        pop: 'pop .45s cubic-bezier(.2,.9,.3,1.3) both',
        slideDown: 'slideDown .4s ease-out both',
        shine: 'shine 2.5s linear infinite',
        floaty: 'floaty 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
