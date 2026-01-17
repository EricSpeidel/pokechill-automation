(() => {
  const existing = window.pokechillAutoRefight;
  if (existing?.cleanup) {
    existing.cleanup();
    return;
  }

  const STORAGE_KEY = "pokechillAutoRefightEnabled";
  const UI_ID = "pokechill-auto-refight";
  const state = {
    enabled: localStorage.getItem(STORAGE_KEY) === "true",
    timer: null,
    observer: null,
    lastRefightAt: 0,
    resumeBurst: null,
    gameLoopOriginal: null,
    resumeListener: null,
    useNativeRefight: localStorage.getItem("pokechillAutoRefightUseNative") === "true",
    preserveTickets: localStorage.getItem("pokechillAutoRefightPreserveTickets") === "true",
    leaveCombatOriginal: null,
  };

  const setEnabled = (value) => {
    state.enabled = value;
    localStorage.setItem(STORAGE_KEY, String(value));
    updateUi();
  };

  const setUseNativeRefight = (value) => {
    state.useNativeRefight = value;
    localStorage.setItem("pokechillAutoRefightUseNative", String(value));
    updateUi();
  };

  const setPreserveTickets = (value) => {
    state.preserveTickets = value;
    localStorage.setItem("pokechillAutoRefightPreserveTickets", String(value));
    updateUi();
  };

  const isVisible = (element) => {
    if (!element) {
      return false;
    }

    if (element.offsetParent !== null) {
      return true;
    }

    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };

  const shouldRefight = () => {
    if (!state.enabled) {
      return false;
    }

    const areaEnd = document.getElementById("area-end");
    return isVisible(areaEnd);
  };

  const triggerRefight = () => {
    if (state.useNativeRefight && typeof window.autoRefight === "function") {
      const now = Date.now();
      if (now - state.lastRefightAt < 1000) {
        return;
      }

      state.lastRefightAt = now;
      window.autoRefight();
      return;
    }

    const refightButton = document.getElementById("area-rejoin");
    if (!refightButton) {
      return;
    }

    const now = Date.now();
    if (now - state.lastRefightAt < 1000) {
      return;
    }

    state.lastRefightAt = now;
    refightButton.click();
  };

  const tick = () => {
    if (shouldRefight()) {
      triggerRefight();
    }
  };

  const createIntervalTimer = (callback, intervalMs) => {
    const intervalId = window.setInterval(callback, intervalMs);
    return {
      stop: () => window.clearInterval(intervalId),
    };
  };

  const createWorkerTimer = (callback, intervalMs) => {
    if (!window.Worker || !window.Blob || !window.URL?.createObjectURL) {
      return null;
    }

    const workerScript = `
      let intervalId = null;
      self.onmessage = (event) => {
        const { type, interval } = event.data || {};
        if (type === "start") {
          clearInterval(intervalId);
          intervalId = setInterval(() => self.postMessage({ type: "tick" }), interval);
        }
        if (type === "stop") {
          clearInterval(intervalId);
          intervalId = null;
        }
      };
    `;

    const blob = new Blob([workerScript], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);

    worker.onmessage = (event) => {
      if (event.data?.type === "tick") {
        callback();
      }
    };

    worker.postMessage({ type: "start", interval: intervalMs });

    return {
      stop: () => {
        worker.postMessage({ type: "stop" });
        worker.terminate();
      },
    };
  };

  const updateUi = () => {
    const root = document.getElementById(UI_ID);
    if (!root) {
      return;
    }

    const enabledCheckbox = root.querySelector("input[data-role='enabled']");
    if (enabledCheckbox) {
      enabledCheckbox.checked = state.enabled;
    }

    const nativeCheckbox = root.querySelector("input[data-role='native']");
    if (nativeCheckbox) {
      nativeCheckbox.checked = state.useNativeRefight;
    }

    const preserveCheckbox = root.querySelector("input[data-role='preserve']");
    if (preserveCheckbox) {
      preserveCheckbox.checked = state.preserveTickets;
    }

    root.dataset.enabled = state.enabled ? "true" : "false";
  };

  const wrapGameLoop = () => {
    if (state.gameLoopOriginal) {
      return;
    }

    const maybeLoop = window.gameLoop;
    if (typeof maybeLoop !== "function") {
      return;
    }

    state.gameLoopOriginal = maybeLoop;
    window.gameLoop = function pokechillAutoRefightLoop(...args) {
      const result = state.gameLoopOriginal.apply(this, args);
      tick();
      return result;
    };
  };

  const wrapLeaveCombat = () => {
    if (state.leaveCombatOriginal) {
      return;
    }

    const maybeLeaveCombat = window.leaveCombat;
    if (typeof maybeLeaveCombat !== "function") {
      return;
    }

    state.leaveCombatOriginal = maybeLeaveCombat;
    window.leaveCombat = function pokechillAutoRefightLeaveCombat(...args) {
      const ticketCount = window.item?.autoRefightTicket?.got;
      const result = state.leaveCombatOriginal.apply(this, args);
      if (state.preserveTickets && typeof ticketCount === "number") {
        if (window.item?.autoRefightTicket) {
          window.item.autoRefightTicket.got = ticketCount;
        }
      }
      return result;
    };
  };

  const startResumeBurst = () => {
    if (state.resumeBurst) {
      window.clearInterval(state.resumeBurst);
    }

    const startedAt = Date.now();
    state.resumeBurst = window.setInterval(() => {
      tick();
      if (Date.now() - startedAt > 3000) {
        window.clearInterval(state.resumeBurst);
        state.resumeBurst = null;
      }
    }, 250);
  };

  const handleVisibilityResume = () => {
    if (!state.enabled) {
      return;
    }

    if (document.visibilityState === "visible") {
      wrapGameLoop();
      startResumeBurst();
    }
  };

  const ensureUi = () => {
    if (document.getElementById(UI_ID)) {
      updateUi();
      return;
    }

    const host = document.getElementById("explore-drops") ?? document.body;
    const container = document.createElement("div");
    container.id = UI_ID;
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.gap = "0.5rem";
    container.style.margin = "0.5rem 0";
    container.style.padding = "0.4rem 0.6rem";
    container.style.borderRadius = "0.5rem";
    container.style.background = "rgba(28, 32, 40, 0.8)";
    container.style.color = "#f2f5ff";
    container.style.fontSize = "0.9rem";
    container.style.border = "1px solid rgba(255, 255, 255, 0.15)";
    container.style.zIndex = "25";

    const buildToggle = (labelText, role, checked, onChange) => {
      const label = document.createElement("label");
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.gap = "0.4rem";
      label.style.cursor = "pointer";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.role = role;
      checkbox.checked = checked;
      checkbox.addEventListener("change", () => {
        onChange(checkbox.checked);
      });

      const text = document.createElement("span");
      text.textContent = labelText;

      label.appendChild(checkbox);
      label.appendChild(text);
      return label;
    };

    const enabledToggle = buildToggle(
      "Auto-refight (manual click)",
      "enabled",
      state.enabled,
      setEnabled
    );
    const nativeToggle = buildToggle(
      "Prefer built-in auto-refight",
      "native",
      state.useNativeRefight,
      setUseNativeRefight
    );
    const preserveToggle = buildToggle(
      "Preserve auto-refight tickets",
      "preserve",
      state.preserveTickets,
      setPreserveTickets
    );

    container.appendChild(enabledToggle);
    container.appendChild(nativeToggle);
    container.appendChild(preserveToggle);

    host.appendChild(container);
    updateUi();
  };

  const start = () => {
    ensureUi();
    if (state.timer?.stop) {
      state.timer.stop();
    }

    const workerTimer = createWorkerTimer(tick, 1000);
    state.timer = workerTimer ?? createIntervalTimer(tick, 1000);
    state.observer = new MutationObserver(ensureUi);
    state.observer.observe(document.body, { childList: true, subtree: true });
    wrapGameLoop();
    wrapLeaveCombat();
    state.resumeListener = handleVisibilityResume;
    document.addEventListener("visibilitychange", state.resumeListener);
    window.addEventListener("focus", state.resumeListener);
  };

  const cleanup = () => {
    if (state.timer?.stop) {
      state.timer.stop();
    }

    if (state.observer) {
      state.observer.disconnect();
    }

    if (state.resumeBurst) {
      window.clearInterval(state.resumeBurst);
      state.resumeBurst = null;
    }

    if (state.resumeListener) {
      document.removeEventListener("visibilitychange", state.resumeListener);
      window.removeEventListener("focus", state.resumeListener);
    }

    if (state.gameLoopOriginal) {
      window.gameLoop = state.gameLoopOriginal;
      state.gameLoopOriginal = null;
    }

    if (state.leaveCombatOriginal) {
      window.leaveCombat = state.leaveCombatOriginal;
      state.leaveCombatOriginal = null;
    }

    const root = document.getElementById(UI_ID);
    if (root) {
      root.remove();
    }

    delete window.pokechillAutoRefight;
  };

  window.pokechillAutoRefight = {
    cleanup,
    setEnabled,
    setUseNativeRefight,
    setPreserveTickets,
  };

  start();
})();
