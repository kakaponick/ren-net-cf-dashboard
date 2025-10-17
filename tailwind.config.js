/** @type {import('tailwindcss').Config} */
module.exports = {
		darkMode: ["class"],
		content: [
				"./app/**/*.{js,ts,jsx,tsx,mdx}",
				"./src/**/*.{js,ts,jsx,tsx,mdx}",
		],
		theme: {
				extend: {
						fontFamily: {
								sans: ['var(--font-geist-sans)', 'sans-serif'],
								mono: ['var(--font-geist-mono)', 'monospace'],
						},
						borderRadius: {
								lg: "var(--radius)",
								md: "calc(var(--radius) - 2px)",
								sm: "calc(var(--radius) - 4px)"
						},
						colors: {}
				}
		},
		plugins: [require("tailwindcss-animate")],
}
