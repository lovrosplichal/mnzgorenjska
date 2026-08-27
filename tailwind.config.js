/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gnl: {
          50: '#eefdf5',
          100: '#d6f9e6',
          200: '#aff1cf',
          300: '#6fe4ae',
          400: '#34d399',
          500: '#12b981',
          600: '#059468',
          700: '#047655',
          800: '#065d45',
          900: '#064c3a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
