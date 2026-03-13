module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: [
          "HarmonyOS Sans SC",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "sans-serif",
        ],
        body: [
          "HarmonyOS Sans SC",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
      colors: {
        ink: {
          900: "#0f1a24",
          700: "#1b2a3a",
          500: "#2c3f52",
        },
        sand: {
          50: "#f7f4ef",
          100: "#efe9df",
        },
        lime: {
          500: "#97f08f",
          600: "#6ed966",
        },
        coral: {
          400: "#ff9b7d",
          500: "#ff7d5a",
        },
        blue: {
          500: "#3aa7ff",
          700: "#2b7bd1",
        },
      },
      boxShadow: {
        card: "0 20px 60px -30px rgba(15, 26, 36, 0.6)",
        soft: "0 12px 30px -18px rgba(15, 26, 36, 0.4)",
      },
      borderRadius: {
        xl: "1.25rem",
      },
    },
  },
  plugins: [],
};
