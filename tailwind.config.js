/** @type {import('tailwindcss').Config} */
export default {
  content: ['./frontend/index.html', './frontend/src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0F172A',
        neon: '#3B82F6',
        emerald: '#10B981'
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.22)',
        neon: '0 0 24px rgba(59, 130, 246, 0.55)'
      },
      backgroundImage: {
        'dashboard-gradient': 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(16,185,129,0.12))'
      }
    }
  },
  plugins: []
};
