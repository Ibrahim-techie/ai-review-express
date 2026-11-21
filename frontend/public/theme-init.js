// Sets the theme class before first paint so nothing flashes. Loaded as a
// file rather than inline so the server's CSP can keep `script-src 'self'`.
// Mirrors ThemeScript in src/components/theme-provider.jsx.
(function () {
  try {
    var t = localStorage.getItem("chaiui-theme");
    if (t !== "light" && t !== "dark") t = "dark";
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.style.colorScheme = t;
  } catch {
    document.documentElement.classList.add("dark");
  }
})();
