import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  corePlugins: { preflight: false }, // 避免与 Ant Design 样式冲突
  theme: {
    extend: {
      colors: {
        primary: '#1677FF',
        success: '#52C41A',
        warning: '#FAAD14',
        error: '#F5222D',
      },
    },
  },
  plugins: [],
} satisfies Config;
