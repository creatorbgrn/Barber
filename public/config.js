window.CREWE_CUT_CONFIG = {
  supabaseUrl: "https://fefjufwpurivcxkatrxg.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlZmp1ZndwdXJpdmN4a2F0cnhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjI5MjEsImV4cCI6MjA5MTk5ODkyMX0.qe1-Mf5SplzAxaVZxgDe3Y4YTukRxSyA0LoXqE3hBEw"
};

(function loadAdminEnhancements() {
  const isAdminPage = document.body?.classList.contains("admin-body") || /admin\.html?$/.test(window.location.pathname);
  if (!isAdminPage) {
    return;
  }

  const version = "202604211720-admin-analytics";
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = `admin-enhancements.css?v=${version}`;
  document.head.appendChild(stylesheet);

  window.addEventListener("load", () => {
    const script = document.createElement("script");
    script.src = `admin-enhancements.js?v=${version}`;
    document.body.appendChild(script);
  });
})();
