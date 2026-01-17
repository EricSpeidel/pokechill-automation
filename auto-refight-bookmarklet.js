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
  };

  const setEnabled = (value) => {
    state.enabled = value;
    localStorage.setItem(STORAGE_KEY, String(value));
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

    const checkbox = root.querySelector("input");
    if (checkbox) {
      checkbox.checked = state.enabled;
    }

    root.dataset.enabled = state.enabled ? "true" : "false";
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

    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "0.4rem";
    label.style.cursor = "pointer";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.enabled;
    checkbox.addEventListener("change", () => {
      setEnabled(checkbox.checked);
    });

    const text = document.createElement("span");
    text.textContent = "Auto-refight (manual click)";

    label.appendChild(checkbox);
    label.appendChild(text);
    container.appendChild(label);

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
  };

  const cleanup = () => {
    if (state.timer?.stop) {
      state.timer.stop();
    }

    if (state.observer) {
      state.observer.disconnect();
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
  };

  start();
})();
