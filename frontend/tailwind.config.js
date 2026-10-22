/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        jira: {
          blue: "#0C66E4",
          "blue-hover": "#0052CC",
          "blue-subtle": "#E9F2FF",
          dark: "#172B4D",
          text: "#172B4D",
          subtle: "#626F86",
          border: "#DCDFE4",
          "border-subtle": "#091E4224",
          bg: "#F7F8F9",
          column: "#F1F2F4",
          "column-hover": "#E9EAEB",
          card: "#FFFFFF",
          "card-hover": "#F8F9FA",
          story: "#00875A",
          bug: "#E5493A",
          task: "#2684FF",
          epic: "#904EE2",
          subtask: "#4BADE8",
          highest: "#DE350B",
          high: "#FF5630",
          medium: "#FFAB00",
          low: "#36B37E",
          lowest: "#0065FF",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)",
        "card-hover": "0 4px 8px -2px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)",
        "jira-dropdown": "0 4px 8px -2px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)",
        "jira-modal": "0 8px 16px -4px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)",
      },
    },
  },
  plugins: [],
};
