export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#185749',
        'primary-dark': '#0D3732',
        'primary-light': '#B5E3D4',
        secondary: '#389C52',
        accent: '#1CAAA8',
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      spacing: {
        '30': '7.5rem',
      }
    },
  },
  plugins: [],
}