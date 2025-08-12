/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'media', // uses prefers-color-scheme
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        white: '#ffffff',
        whiteSoft: '#f8f8f8',
        whiteMute: '#f2f2f2',
        black: '#181818',
        blackSoft: '#222222',
        blackMute: '#282828',
        indigo: '#2c3e50',
        dividerLight1: 'rgba(60, 60, 60, 0.29)',
        dividerLight2: 'rgba(60, 60, 60, 0.12)',
        dividerDark1: 'rgba(84, 84, 84, 0.65)',
        dividerDark2: 'rgba(84, 84, 84, 0.48)',
        textLight1: '#2c3e50',
        textLight2: 'rgba(60, 60, 60, 0.66)',
        textDark1: '#ffffff',
        textDark2: 'rgba(235, 235, 235, 0.64)',
        background: '#ffffff',
        backgroundSoft: '#f8f8f8',
        backgroundMute: '#f2f2f2',
        border: 'rgba(60, 60, 60, 0.12)',
        borderHover: 'rgba(60, 60, 60, 0.29)',
        heading: '#2c3e50',
        text: '#2c3e50'
      }
    }
  },
  plugins: []
}
