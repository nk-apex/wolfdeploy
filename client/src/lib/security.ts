/*
 * WolfDeploy — Frontend Security Layer
 * Anti-devtools, anti-iframe, anti-scraping, console hardening
 */

const IS_PROD = import.meta.env.PROD;

/* ── 1. Frame-busting — prevent embedding in iframes ─────── */
function enforceNoFrame() {
  if (window.self !== window.top) {
    // We're inside an iframe — break out
    try {
      window.top!.location.href = window.self.location.href;
    } catch (_) {
      // Cross-origin parent blocked us — just blank the page
      document.body.innerHTML = "";
      document.title = "Access Denied";
    }
  }
}

/* ── 2. DevTools detection ───────────────────────────────── */
let devtoolsOpen = false;

function detectDevTools() {
  const threshold = 160;
  const widthDiff = window.outerWidth - window.innerWidth;
  const heightDiff = window.outerHeight - window.innerHeight;

  if (widthDiff > threshold || heightDiff > threshold) {
    if (!devtoolsOpen) {
      devtoolsOpen = true;
      handleDevToolsOpen();
    }
  } else {
    devtoolsOpen = false;
  }
}

function handleDevToolsOpen() {
  if (!IS_PROD) return;
  // Log the event server-side silently
  try {
    fetch("/api/auth/register-ip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "__devtools__", event: "devtools_open" }),
    }).catch(() => {});
  } catch (_) {}
}

/* ── 3. Console trap — poison debugger output ────────────── */
function setupConsoleTrap() {
  const WOLF_BANNER = `
%c⚠  WolfDeploy Security Warning  ⚠
%cThis browser console is intended for developers only.
Do NOT paste any code here — doing so could compromise your account.

%cIf someone told you to paste something here, it's a scam.
`;

  console.log(
    WOLF_BANNER,
    "color:#ef4444;font-size:18px;font-weight:bold;",
    "color:#f59e0b;font-size:13px;",
    "color:#6b7280;font-size:11px;"
  );

  if (IS_PROD) {
    // Override console methods in production to reduce information leakage
    const noop = () => {};
    const _warn = console.warn.bind(console);

    // Keep error and warn for visibility but suppress debug/log
    (window as any).__wolf_console = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    console.log = noop;
    console.debug = noop;
    // Keep warn/error — they're needed for real issues
    console.warn = _warn;
  }
}

/* ── 4. Disable right-click on sensitive elements ────────── */
function setupContextMenuProtection() {
  document.addEventListener("contextmenu", (e) => {
    const target = e.target as HTMLElement;
    // Allow right-click on inputs and textareas (users need copy/paste)
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }
    // Block right-click on the rest of the app in production
    if (IS_PROD) {
      e.preventDefault();
    }
  });
}

/* ── 5. Prevent drag-and-drop data exfiltration ─────────── */
function setupDragProtection() {
  document.addEventListener("dragstart", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG" || target.tagName === "A") {
      if (IS_PROD) e.preventDefault();
    }
  });
}

/* ── 6. Detect and block automated page navigation ─────── */
function detectAutomation() {
  // Check for automation fingerprints
  const nav = window.navigator as any;
  const isAutomated =
    nav.webdriver === true ||
    nav.webdriver === "true" ||
    !!window.__selenium_unwrapped ||
    !!window.__webdriver_evaluate ||
    !!window.__fxdriver_evaluate ||
    !!window.__driver_unwrapped ||
    !!(window as any).callPhantom ||
    !!(window as any)._phantom ||
    !!(window as any).__nightmare;

  if (isAutomated && IS_PROD) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#000;color:#ef4444;font-family:monospace;font-size:14px;text-align:center;">
        <div>
          <div style="font-size:48px;margin-bottom:16px;">🐺</div>
          <div style="color:#22c55e;font-size:18px;font-weight:bold;margin-bottom:8px;">WolfDeploy</div>
          <div>Automated access detected and blocked.</div>
        </div>
      </div>`;
  }
}

/* ── 7. Anti-screenshot / screen-capture hint ───────────── */
function setupScreenCaptureHint() {
  // CSS hint to browsers that support it (Chrome) to protect privacy
  const style = document.createElement("style");
  style.textContent = `
    /* Signal to screen-capture APIs that content is sensitive */
    .sensitive-data {
      -webkit-user-select: none;
      user-select: none;
    }
  `;
  document.head.appendChild(style);
}

/* ── 8. Disable keyboard shortcuts for DevTools ─────────── */
function blockDevToolsShortcuts() {
  if (!IS_PROD) return;
  document.addEventListener("keydown", (e) => {
    // F12
    if (e.key === "F12") { e.preventDefault(); return; }
    // Ctrl+Shift+I / Cmd+Opt+I
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "i")) { e.preventDefault(); return; }
    // Ctrl+Shift+J / Cmd+Opt+J (Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "J" || e.key === "j")) { e.preventDefault(); return; }
    // Ctrl+Shift+C (Inspector)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "C" || e.key === "c")) { e.preventDefault(); return; }
    // Ctrl+U (View Source)
    if ((e.ctrlKey || e.metaKey) && (e.key === "U" || e.key === "u")) { e.preventDefault(); return; }
    // Ctrl+S (Save page)
    if ((e.ctrlKey || e.metaKey) && (e.key === "S" || e.key === "s")) { e.preventDefault(); return; }
  });
}

/* ── INIT — call everything ──────────────────────────────── */
export function initSecurity() {
  enforceNoFrame();
  detectAutomation();
  setupConsoleTrap();
  setupContextMenuProtection();
  setupDragProtection();
  setupScreenCaptureHint();
  blockDevToolsShortcuts();

  // Poll for devtools open/close every 1.5 seconds
  setInterval(detectDevTools, 1500);
}
