/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gnl: {
          50: '#eef7ff',
          500: '#1f7a4d',
          600: '#186040',
          700: '#124a32',
        },
      },
    },
  },
  plugins: [],
}
