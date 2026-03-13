"use strict";

(() => {
  if (window.__HTML_TO_FIGMA_CONTENT_READY__) {
    return;
  }
  window.__HTML_TO_FIGMA_CONTENT_READY__ = true;

  const MESSAGE_TOGGLE = "HTML_TO_FIGMA_TOGGLE";
  const MESSAGE_SET_ENABLED = "HTML_TO_FIGMA_SET_ENABLED";
  const MESSAGE_GET_TAB_STATE = "HTML_TO_FIGMA_GET_TAB_STATE";
  const CAPTURE_URL = "https://mcp.figma.com/mcp/html-to-design/capture.js";
  const CAPTURE_LOCAL_URL = chrome.runtime.getURL("vendor/figma-capture.js");
  const CAPTURE_SELECTOR_ATTR = "data-h2f-capture-target";
  const BRIDGE_SCRIPT_ID = "__html_to_figma_page_bridge__";
  const ROOT_ID = "__html_to_figma_overlay_root__";
  const ACTION_BAR_ROOT_ID = "__html_to_figma_action_bar__";
  const OFFICIAL_TOOLBAR_HOST_ID = "__figma_capture_toolbar_host__";
  const OFFICIAL_TOOLBAR_HIDE_STYLE_ID = "__h2f_hide_official_toolbar__";
  const DISALLOWED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "META",
    "LINK",
    "NOSCRIPT",
    "TITLE",
    "BR",
  ]);
  const INLINE_TEXT_TAGS = new Set([
    "SPAN",
    "EM",
    "STRONG",
    "B",
    "I",
    "SMALL",
    "MARK",
    "A",
    "LABEL",
    "CODE",
  ]);
  const SVG_TAGS = new Set([
    "SVG",
    "PATH",
    "G",
    "RECT",
    "CIRCLE",
    "ELLIPSE",
    "LINE",
    "POLYLINE",
    "POLYGON",
    "TEXT",
    "USE",
  ]);
  const MEDIA_TAGS = new Set(["IMG", "PICTURE", "VIDEO", "CANVAS"]);
  const DOUBLE_META_TAP_MS = 360;
  const DOUBLE_ESC_TAP_MS = 360;
  const CAPTURE_ACK_TIMEOUT_MS = 1600;
  const LOCAL_CAPTURE_API_TIMEOUT_MS = 2000;
  const TOP_TOAST_ENABLED = false;

  class HtmlToFigmaInspector {
    constructor() {
      this.enabled = false;
      this.shiftDown = false;
      this.copyInFlight = false;
      this.renderScheduled = false;
      this.inspectPaused = false;
      this.lastMetaTapAt = 0;
      this.lastEscTapAt = 0;
      this.hoverElement = null;
      this.flexElement = null;
      this.selectedElements = new Set();
      this.selectionBoxes = new Map();
      this.statusMessage = "Idle";
      this.statusTimeout = null;
      this.toastTimeout = null;
      this.actionBarResetTimer = null;
      this.pointerX = 0;
      this.pointerY = 0;
      this.bridgeReady = false;
      this.requestCounter = 0;
      this.actionBar = null;

      this.overlayRoot = null;
      this.overlayShadow = null;
      this.hoverBox = null;
      this.flexBox = null;
      this.selectedLayer = null;
      this.cursorBadge = null;
      this.toastEl = null;
      this.toastTextEl = null;

      this.onMouseMove = this.onMouseMove.bind(this);
      this.onClick = this.onClick.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onKeyUp = this.onKeyUp.bind(this);
      this.onScrollOrResize = this.onScrollOrResize.bind(this);
      this.onWindowBlur = this.onWindowBlur.bind(this);
    }

    toggle() {
      this.setEnabled(!this.enabled);
      return { enabled: this.enabled };
    }

    setEnabled(nextEnabled) {
      if (nextEnabled) {
        this.enable();
      } else {
        this.disable();
      }
      return { enabled: this.enabled };
    }

    enable() {
      if (this.enabled) {
        return;
      }
      this.enabled = true;
      this.inspectPaused = false;
      this.lastMetaTapAt = 0;
      this.lastEscTapAt = 0;
      this.mountOverlay();
      this.attachEvents();
      this.setOfficialToolbarHidden(true);
      this.setStatus("Capture mode on", 1400);
      this.showDefaultActionBar();
      this.updateUi();
      this.scheduleRender();
      this.prewarmCapturePipeline();
    }

    disable() {
      if (!this.enabled) {
        return;
      }
      this.enabled = false;
      this.shiftDown = false;
      this.inspectPaused = false;
      this.lastMetaTapAt = 0;
      this.lastEscTapAt = 0;
      this.hoverElement = null;
      this.flexElement = null;
      this.clearSelections();
      this.detachEvents();
      this.unmountOverlay();
      this.clearStatusTimer();
      this.clearToastTimer();
      this.setOfficialToolbarHidden(false);
      this.clearActionBarTimer();
      this.unmountActionBar();
    }

    attachEvents() {
      document.addEventListener("mousemove", this.onMouseMove, true);
      document.addEventListener("click", this.onClick, true);
      document.addEventListener("keydown", this.onKeyDown, true);
      document.addEventListener("keyup", this.onKeyUp, true);
      window.addEventListener("scroll", this.onScrollOrResize, true);
      window.addEventListener("resize", this.onScrollOrResize, true);
      window.addEventListener("blur", this.onWindowBlur, true);
    }

    detachEvents() {
      document.removeEventListener("mousemove", this.onMouseMove, true);
      document.removeEventListener("click", this.onClick, true);
      document.removeEventListener("keydown", this.onKeyDown, true);
      document.removeEventListener("keyup", this.onKeyUp, true);
      window.removeEventListener("scroll", this.onScrollOrResize, true);
      window.removeEventListener("resize", this.onScrollOrResize, true);
      window.removeEventListener("blur", this.onWindowBlur, true);
    }

    mountOverlay() {
      this.unmountOverlay();

      this.overlayRoot = document.createElement("div");
      this.overlayRoot.id = ROOT_ID;
      this.overlayRoot.style.position = "fixed";
      this.overlayRoot.style.inset = "0";
      this.overlayRoot.style.pointerEvents = "none";
      this.overlayRoot.style.zIndex = "2147483647";

      this.overlayShadow = this.overlayRoot.attachShadow({ mode: "open" });

      const style = document.createElement("style");
      style.textContent = `
        :host {
          all: initial;
        }
        #layer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        }
        .box {
          position: fixed;
          left: 0;
          top: 0;
          display: none;
          box-sizing: border-box;
          pointer-events: none;
          transform: translate3d(0, 0, 0);
        }
        .hover {
          border: 1.5px solid #2f6bff;
          background: rgba(47, 107, 255, 0.12);
        }
        .flex {
          border: 1px dashed #2f6bff;
          background: rgba(47, 107, 255, 0.04);
        }
        .selected {
          border: 1.5px solid #1f53d6;
          background: rgba(47, 107, 255, 0.18);
        }
        #cursor {
          position: fixed;
          left: 0;
          top: 0;
          display: none;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid #2f6bff;
          background: #2f6bff;
          color: #FFFFFF;
          font-size: 14px;
          line-height: 1.2;
          letter-spacing: 0.02em;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 8px 24px rgba(22, 53, 120, 0.18);
          transform: translate3d(0, 0, 0);
        }
        #toast {
          position: fixed;
          left: 50%;
          top: 18px;
          transform: translate3d(-50%, -10px, 0);
          display: none;
          opacity: 0;
          padding: 6px 12px;
          border-radius: 20px;
          background: #000000;
          color: #ffffff;
          font-size: 15px;
          font-weight: 500;
          line-height: 24px;
          white-space: nowrap;
          pointer-events: none;
          transition: opacity 140ms ease, transform 140ms ease;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
          z-index: 2147483647;
          align-items: center;
          gap: 8px;
        }
        #toast.show {
          opacity: 1;
          transform: translate3d(-50%, 0, 0);
        }
        #toast .toast-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: h2f-spin 0.8s linear infinite;
          display: none;
          flex: 0 0 auto;
        }
        #toast.loading .toast-spinner {
          display: inline-block;
        }
        #toast .toast-text {
          display: inline-block;
        }
        @keyframes h2f-spin {
          to {
            transform: rotate(360deg);
          }
        }
        #toolbar {
          position: fixed;
          right: 18px;
          bottom: 18px;
          width: 210px;
          padding: 16px;
          border-radius: 14px;
          background: #2C2C2C;
          color: #FFFFFF;
          box-shadow: 0 16px 42px rgba(14, 38, 90, 0.21);
          pointer-events: none;
        }
        #title {
          font-size: 14px;
          letter-spacing: 0.04em;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        hr {
          border-color: rgba(255, 255, 255, 0.11);
          margin: 12px 0;
        }
        .row {
          font-size: 13px;
          line-height: 1.7;
          margin-bottom: 6px;
          opacity: 0.96;
          display: flex;
          justify-content: space-between;
        }
        .container {
          list-style: none;
          padding-left: 0;
          margin: 0 0 8px 0;
        }
        .key {
          display: inline-block;
          background: rgba(255, 255, 255, 0.17);
          padding: 1px 6px;
          border-radius: 6px;
        }
      `;

      const layer = document.createElement("div");
      layer.id = "layer";

      this.hoverBox = document.createElement("div");
      this.hoverBox.className = "box hover";

      this.flexBox = document.createElement("div");
      this.flexBox.className = "box flex";

      this.selectedLayer = document.createElement("div");
      this.selectedLayer.id = "selected-layer";

      this.cursorBadge = document.createElement("div");
      this.cursorBadge.id = "cursor";

      this.toastEl = document.createElement("div");
      this.toastEl.id = "toast";
      this.toastEl.innerHTML = `<span class="toast-spinner" aria-hidden="true"></span><span class="toast-text"></span>`;
      this.toastTextEl = this.toastEl.querySelector(".toast-text");

      let toolbar = null;
      if (this.isTopFrame()) {
        toolbar = document.createElement("div");
        toolbar.id = "toolbar";
        toolbar.innerHTML = `
          <div id="title">HTML to Figma</div>
          <hr/>
          <ul class='container'>
            <li class="row">Copy element <span class='key'>Click</span></li>
            <li class="row">Copy Multiple <span class='key'>⇧ Shift</span></li>
            <li class="row">Select parent <span class='key'>Esc</span></li>
            <li class="row">Exit inspector <span class='key'>Double Esc</span></li>
            <li class="row">Toggle inspect <span class='key'>Double ⌘ Cmd</span></li>
          </ul>
        `;
      }

      layer.appendChild(this.flexBox);
      layer.appendChild(this.hoverBox);
      layer.appendChild(this.selectedLayer);
      layer.appendChild(this.cursorBadge);
      layer.appendChild(this.toastEl);
      if (toolbar) {
        layer.appendChild(toolbar);
      }
      this.overlayShadow.appendChild(style);
      this.overlayShadow.appendChild(layer);

      document.documentElement.appendChild(this.overlayRoot);
    }

    setOfficialToolbarHidden(hidden) {
      const existing = document.getElementById(OFFICIAL_TOOLBAR_HIDE_STYLE_ID);
      if (hidden) {
        if (existing) {
          return;
        }
        const style = document.createElement("style");
        style.id = OFFICIAL_TOOLBAR_HIDE_STYLE_ID;
        style.textContent = `
          #${OFFICIAL_TOOLBAR_HOST_ID} {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
        return;
      }

      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    }

    unmountOverlay() {
      if (this.overlayRoot && this.overlayRoot.parentNode) {
        this.overlayRoot.parentNode.removeChild(this.overlayRoot);
      }

      this.overlayRoot = null;
      this.overlayShadow = null;
      this.hoverBox = null;
      this.flexBox = null;
      this.selectedLayer = null;
      this.cursorBadge = null;
      this.toastEl = null;
      this.toastTextEl = null;
      this.selectionBoxes.clear();
      this.clearToastTimer();
    }

    onMouseMove(event) {
      if (!this.enabled) {
        return;
      }

      if (this.inspectPaused) {
        this.hoverElement = null;
        this.flexElement = null;
        this.updateCursorPosition(false);
        this.scheduleRender();
        this.updateUi();
        return;
      }

      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      this.updateCursorPosition(true);

      const target = this.resolveSelectable(event.target);
      if (!target) {
        this.hoverElement = null;
        this.flexElement = null;
        this.scheduleRender();
        this.updateUi();
        return;
      }

      if (target !== this.hoverElement) {
        this.hoverElement = target;
        this.flexElement = this.findFlexAncestor(target);
        this.scheduleRender();
      }

      this.updateUi();
    }

    onClick(event) {
      if (!this.enabled) {
        return;
      }

      if (this.lastMetaTapAt > 0) {
        this.lastMetaTapAt = 0;
      }
      if (this.lastEscTapAt > 0) {
        this.lastEscTapAt = 0;
      }

      if (this.inspectPaused) {
        return;
      }

      const target = this.resolveSelectable(event.target);
      if (!target) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (this.shiftDown) {
        this.toggleSelection(target);
        this.updateUi();
        this.scheduleRender();
        return;
      }

      if (this.selectedElements.size > 1 && this.selectedElements.has(target)) {
        this.copyElements(Array.from(this.selectedElements));
        return;
      }

      this.clearSelections();
      this.hoverElement = target;
      this.flexElement = this.findFlexAncestor(target);
      this.copyElements([target]);
    }

    onKeyDown(event) {
      if (!this.enabled) {
        return;
      }

      if (event.key === "Meta") {
        if (event.repeat) {
          return;
        }

        const now = Date.now();
        if (this.lastMetaTapAt > 0 && now - this.lastMetaTapAt <= DOUBLE_META_TAP_MS) {
          this.lastMetaTapAt = 0;
          this.inspectPaused = !this.inspectPaused;
          this.shiftDown = false;

          if (this.inspectPaused) {
            this.hoverElement = null;
            this.flexElement = null;
            this.updateCursorPosition(false);
            this.clearActionBarTimer();
            this.unmountActionBar();
            this.setStatus("Inspector paused", 1100);
          } else {
            this.showDefaultActionBar();
            this.setStatus("Inspector resumed", 1100);
          }

          this.updateUi();
          this.scheduleRender();
          return;
        }

        this.lastMetaTapAt = now;
        return;
      }

      if (this.lastMetaTapAt > 0) {
        this.lastMetaTapAt = 0;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        const now = Date.now();
        if (this.lastEscTapAt > 0 && now - this.lastEscTapAt <= DOUBLE_ESC_TAP_MS) {
          this.lastEscTapAt = 0;
          this.disable();
          return;
        }
        this.lastEscTapAt = now;
        if (!this.inspectPaused) {
          this.selectParent();
        }
        return;
      }

      if (this.inspectPaused) {
        if (this.lastEscTapAt > 0) {
          this.lastEscTapAt = 0;
        }
        return;
      }

      if (this.isTypingContext(event.target)) {
        return;
      }

      if (event.key === "Shift") {
        this.shiftDown = true;
        this.updateUi();
        return;
      }

      if (this.lastEscTapAt > 0) {
        this.lastEscTapAt = 0;
      }

      if (event.key === "Enter" && this.selectedElements.size > 0) {
        event.preventDefault();
        this.copyElements(Array.from(this.selectedElements));
        return;
      }

      const isCopyShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c";
      if (isCopyShortcut && this.selectedElements.size > 0) {
        event.preventDefault();
        this.copyElements(Array.from(this.selectedElements));
      }
    }

    onKeyUp(event) {
      if (!this.enabled) {
        return;
      }
      if (event.key === "Shift") {
        this.shiftDown = false;
        this.updateUi();
      }
    }

    onWindowBlur() {
      if (!this.enabled) {
        return;
      }
      this.shiftDown = false;
      this.lastMetaTapAt = 0;
      this.lastEscTapAt = 0;
      this.updateUi();
    }

    onScrollOrResize() {
      if (!this.enabled) {
        return;
      }
      this.scheduleRender();
    }

    resolveSelectable(start) {
      if (!(start instanceof Element)) {
        return null;
      }

      if (this.isActionBarElement(start)) {
        return null;
      }

      if (this.overlayRoot && this.overlayRoot.contains(start)) {
        return null;
      }

      let node = start;
      while (node) {
        if (this.isActionBarElement(node)) {
          return null;
        }
        if (this.overlayRoot && this.overlayRoot.contains(node)) {
          return null;
        }
        if (this.isSelectable(node)) {
          return node;
        }
        node = node.parentElement;
      }

      return null;
    }

    isActionBarElement(element) {
      if (!(element instanceof Element)) {
        return false;
      }
      const actionBarHost = document.getElementById(ACTION_BAR_ROOT_ID);
      if (!actionBarHost) {
        return false;
      }
      return element === actionBarHost || actionBarHost.contains(element);
    }

    isSelectable(element) {
      if (!(element instanceof Element)) {
        return false;
      }

      const tagName = element.tagName;
      if (DISALLOWED_TAGS.has(tagName)) {
        return false;
      }
      if (element === document.documentElement || element === document.head) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        return false;
      }

      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      if (parseFloat(style.opacity || "1") < 0.05) {
        return false;
      }

      return true;
    }

    findFlexAncestor(element) {
      if (!(element instanceof Element)) {
        return null;
      }

      let current = element.parentElement;
      while (current && current !== document.body) {
        const display = window.getComputedStyle(current).display;
        if (display === "flex" || display === "inline-flex") {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    }

    toggleSelection(element) {
      if (this.selectedElements.has(element)) {
        this.selectedElements.delete(element);
        this.setStatus("Removed from selection", 900);
        return;
      }

      for (const existing of Array.from(this.selectedElements)) {
        if (existing.contains(element) || element.contains(existing)) {
          this.selectedElements.delete(existing);
        }
      }

      this.selectedElements.add(element);
      this.setStatus(`${this.selectedElements.size} selected`, 900);
    }

    clearSelections() {
      this.selectedElements.clear();
      for (const box of this.selectionBoxes.values()) {
        box.remove();
      }
      this.selectionBoxes.clear();
    }

    selectParent() {
      const active = this.hoverElement || this.getMostRecentSelection();
      if (!active) {
        this.setStatus("No active element", 900);
        return;
      }

      let parent = active.parentElement;
      while (parent && !this.isSelectable(parent)) {
        parent = parent.parentElement;
      }

      if (!parent) {
        this.setStatus("Already at top container", 1000);
        return;
      }

      this.hoverElement = parent;
      this.flexElement = this.findFlexAncestor(parent);
      this.setStatus("Selected parent", 1000);
      this.updateUi();
      this.scheduleRender();
    }

    getMostRecentSelection() {
      let latest = null;
      for (const element of this.selectedElements) {
        latest = element;
      }
      return latest;
    }

    updateCursorPosition(visible) {
      if (!this.cursorBadge) {
        return;
      }

      this.cursorBadge.style.display = visible && this.hoverElement ? "block" : "none";
      this.cursorBadge.style.transform = `translate3d(${this.pointerX + 14}px, ${this.pointerY + 12}px, 0)`;
    }

    scheduleRender() {
      if (this.renderScheduled) {
        return;
      }
      this.renderScheduled = true;
      window.requestAnimationFrame(() => {
        this.renderScheduled = false;
        this.render();
      });
    }

    render() {
      if (!this.enabled || !this.hoverBox || !this.flexBox) {
        return;
      }

      this.paintBox(this.hoverBox, this.hoverElement);
      this.paintBox(this.flexBox, this.flexElement);
      this.renderSelectionBoxes();
    }

    renderSelectionBoxes() {
      if (!this.selectedLayer) {
        return;
      }

      for (const [element, box] of Array.from(this.selectionBoxes.entries())) {
        if (!this.selectedElements.has(element)) {
          box.remove();
          this.selectionBoxes.delete(element);
        }
      }

      for (const element of this.selectedElements) {
        let box = this.selectionBoxes.get(element);
        if (!box) {
          box = document.createElement("div");
          box.className = "box selected";
          this.selectedLayer.appendChild(box);
          this.selectionBoxes.set(element, box);
        }
        this.paintBox(box, element);
      }
    }

    paintBox(box, element) {
      if (!box) {
        return;
      }
      if (!element || !this.isSelectable(element)) {
        box.style.display = "none";
        return;
      }

      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const radius = parseFloat(style.borderTopLeftRadius || "0") || 0;

      box.style.display = "block";
      box.style.width = `${Math.max(0, rect.width)}px`;
      box.style.height = `${Math.max(0, rect.height)}px`;
      box.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
      box.style.borderRadius = `${radius}px`;
    }

    updateUi() {
      if (!this.cursorBadge) {
        return;
      }

      const activeType = this.hoverElement ? this.classifyElement(this.hoverElement) : "layout";
      this.cursorBadge.textContent = this.shiftDown ? `${activeType} multi` : activeType;
    }

    isTopFrame() {
      try {
        return window.top === window;
      } catch (_error) {
        return false;
      }
    }

    ensureActionBar() {
      if (!this.isTopFrame()) {
        return null;
      }
      if (this.actionBar) {
        return this.actionBar;
      }
      if (typeof window.HtmlToFigmaActionBar !== "function") {
        return null;
      }
      this.actionBar = new window.HtmlToFigmaActionBar();
      return this.actionBar;
    }

    unmountActionBar() {
      if (this.actionBar) {
        this.actionBar.unmount();
        this.actionBar = null;
      }
    }

    clearActionBarTimer() {
      if (this.actionBarResetTimer) {
        window.clearTimeout(this.actionBarResetTimer);
        this.actionBarResetTimer = null;
      }
    }

    showDefaultActionBar() {
      const bar = this.ensureActionBar();
      if (!bar) {
        return;
      }
      this.clearActionBarTimer();
      bar.setState({
        variant: "main",
        icon: null,
        message: "Send to Figma",
        minWidth: 490,
        actions: [
          {
            icon: "capture",
            label: "Capture page",
            onClick: () => this.captureWholePage(),
          },
          {
            icon: "select",
            label: "Select element",
            onClick: () => this.focusSelectMode(),
          },
        ],
      });
    }

    showLoadingActionBar(message) {
      const bar = this.ensureActionBar();
      if (!bar) {
        return;
      }
      this.clearActionBarTimer();
      bar.setState({
        icon: "spinner",
        message: message || "Capturing...",
        minWidth: 265,
        actions: [],
      });
    }

    showSuccessActionBar(message) {
      const bar = this.ensureActionBar();
      if (!bar) {
        return;
      }
      this.clearActionBarTimer();
      bar.setState({
        icon: "ok",
        message,
        minWidth: 265,
        actions: [],
      });
      this.actionBarResetTimer = window.setTimeout(() => {
        if (this.enabled) {
          this.showDefaultActionBar();
        }
      }, 1800);
    }

    showErrorActionBar(message) {
      const bar = this.ensureActionBar();
      if (!bar) {
        return;
      }
      this.clearActionBarTimer();
      bar.setState({
        icon: "error",
        message: message || "Capture failed",
        minWidth: 265,
        actions: [],
      });
      this.actionBarResetTimer = window.setTimeout(() => {
        if (this.enabled) {
          this.showDefaultActionBar();
        }
      }, 2200);
    }

    focusSelectMode() {
      this.inspectPaused = false;
      this.setStatus("Select element mode", 1000);
      this.showDefaultActionBar();
    }

    captureWholePage() {
      if (this.copyInFlight) {
        return;
      }
      this.inspectPaused = true;
      this.clearSelections();
      this.hoverElement = document.body;
      this.flexElement = this.findFlexAncestor(document.body);
      this.scheduleRender();
      this.copyElements([document.body]);
    }

    classifyElement(element) {
      if (!(element instanceof Element)) {
        return "layout";
      }

      const tagName = element.tagName;
      if (SVG_TAGS.has(tagName) || element instanceof SVGElement) {
        return "svg";
      }

      if (MEDIA_TAGS.has(tagName)) {
        return "image";
      }

      if (this.hasPredominantText(element)) {
        return "text";
      }

      const svgChild = element.querySelector("svg");
      if (svgChild && element.children.length <= 2 && !this.hasMediaChild(element)) {
        return "svg";
      }

      return "layout";
    }

    hasPredominantText(element) {
      const text = (element.textContent || "").trim();
      if (!text) {
        return false;
      }
      if (this.hasMediaChild(element)) {
        return false;
      }

      if (element.children.length === 0) {
        return true;
      }

      if (element.children.length > 2) {
        return false;
      }

      for (const child of Array.from(element.children)) {
        if (!INLINE_TEXT_TAGS.has(child.tagName)) {
          return false;
        }
      }

      return true;
    }

    hasMediaChild(element) {
      return Boolean(element.querySelector("img, picture, video, canvas, svg"));
    }

    async copyElements(elements) {
      if (!elements.length || this.copyInFlight) {
        return;
      }

      this.copyInFlight = true;
      this.setStatus("Copying...", 0);
      this.updateUi();
      this.showLoadingToast("Translating HTML to Figma layers");
      this.showLoadingActionBar("Translating HTML to Figma layers");

      const capturePlan = this.createCapturePlan(elements);
      const payload = this.buildPayload(elements, capturePlan);

      try {
        const captureResult = await this.captureViaOfficialCapture(capturePlan.request);
        const cleanupDelay = captureResult && captureResult.pending ? capturePlan.cleanupDelayMs : 0;
        this.releaseCapturePlan(capturePlan, cleanupDelay);
        this.setStatus(`Copied ${elements.length} to Figma`, 1800);
        this.showToast(this.buildCopiedToastText(elements.length), 1800);
        this.showSuccessActionBar(this.buildCopiedToastText(elements.length));
      } catch (error) {
        this.releaseCapturePlan(capturePlan, 0);
        try {
          await this.copyPayloadToClipboard(payload);
          this.setStatus(`Fallback copy (${elements.length})`, 2200);
          this.showToast(this.buildCopiedToastText(elements.length), 2200);
          this.showSuccessActionBar(this.buildCopiedToastText(elements.length));
          console.warn("html-to-figma: capture.js unavailable, used clipboard fallback", error);
        } catch (clipboardError) {
          this.setStatus("Copy failed", 2200);
          this.showToast("Copy failed", 2200);
          this.showErrorActionBar("Copy failed");
          console.error("html-to-figma: clipboard fallback failed", clipboardError);
        }
      } finally {
        this.copyInFlight = false;
        if (this.enabled) {
          this.inspectPaused = false;
        }
        if (!this.shiftDown) {
          this.clearSelections();
        }
        this.updateUi();
        this.scheduleRender();
      }
    }

    createCapturePlan(elements) {
      const target = this.findCaptureTarget(elements);
      const selectorPlan = this.createSelectorPlan(target);

      return {
        target,
        selector: selectorPlan.selector,
        cleanup: selectorPlan.cleanup,
        cleanupDelayMs: 1800,
        request: {
          selector: selectorPlan.selector,
          delayMs: 0,
          verbose: false,
          ackTimeoutMs: CAPTURE_ACK_TIMEOUT_MS,
          useHtmlClipboardEncoding: true,
          sourceUrl: window.location.href,
          sourceTitle: document.title,
          selectedCount: elements.length,
        },
      };
    }

    releaseCapturePlan(capturePlan, delayMs = 0) {
      if (!capturePlan || typeof capturePlan.cleanup !== "function") {
        return;
      }
      const runCleanup = () => {
        try {
          capturePlan.cleanup();
        } catch (error) {
          console.warn("html-to-figma: capture cleanup error", error);
        }
      };
      if (delayMs > 0) {
        window.setTimeout(runCleanup, delayMs);
      } else {
        runCleanup();
      }
    }

    createSelectorPlan(targetElement) {
      const token = this.createCaptureToken();
      const previousValue = targetElement.getAttribute(CAPTURE_SELECTOR_ATTR);
      targetElement.setAttribute(CAPTURE_SELECTOR_ATTR, token);

      return {
        selector: `[${CAPTURE_SELECTOR_ATTR}="${token}"]`,
        cleanup: () => {
          const activeValue = targetElement.getAttribute(CAPTURE_SELECTOR_ATTR);
          if (activeValue !== token) {
            return;
          }
          if (previousValue === null) {
            targetElement.removeAttribute(CAPTURE_SELECTOR_ATTR);
          } else {
            targetElement.setAttribute(CAPTURE_SELECTOR_ATTR, previousValue);
          }
        },
      };
    }

    createCaptureToken() {
      const randomPart = Math.random().toString(36).slice(2, 8);
      return `h2f-${Date.now().toString(36)}-${randomPart}`;
    }

    findCaptureTarget(elements) {
      if (elements.length === 1) {
        return elements[0];
      }

      const lca = this.findLowestCommonAncestor(elements);
      if (!lca || lca === document.body || lca === document.documentElement) {
        this.setStatus("Multi selection too broad, captured first item", 1600);
        return elements[0];
      }

      return lca;
    }

    findLowestCommonAncestor(elements) {
      if (!elements.length) {
        return null;
      }
      if (elements.length === 1) {
        return elements[0];
      }

      const [first, ...rest] = elements;
      const ancestors = [];
      let current = first;
      while (current) {
        ancestors.push(current);
        current = current.parentElement;
      }

      for (const candidate of ancestors) {
        if (rest.every((element) => candidate === element || candidate.contains(element))) {
          return candidate;
        }
      }

      return null;
    }

    buildPayload(elements, capturePlan) {
      return {
        sourceUrl: window.location.href,
        sourceTitle: document.title,
        captureScript: CAPTURE_URL,
        capturedAt: new Date().toISOString(),
        captureRequest: capturePlan
          ? {
              selector: capturePlan.selector,
              mode: "clipboard",
              selectedCount: elements.length,
            }
          : null,
        elements: elements.map((element) => this.serializeElement(element)),
      };
    }

    serializeElement(element) {
      const rect = element.getBoundingClientRect();
      const type = this.classifyElement(element);
      const html = element.outerHTML || "";

      return {
        type,
        tagName: element.tagName.toLowerCase(),
        selector: this.buildCssPath(element),
        text: (element.textContent || "").trim().slice(0, 2000),
        html: html.slice(0, 12000),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
      };
    }

    buildCssPath(element) {
      const parts = [];
      let current = element;
      let depth = 0;

      while (current && current instanceof Element && depth < 8) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector += `#${CSS.escape(current.id)}`;
          parts.unshift(selector);
          break;
        }

        const className = (current.className || "").toString().trim();
        if (className) {
          const firstClass = className.split(/\s+/)[0];
          if (firstClass) {
            selector += `.${CSS.escape(firstClass)}`;
          }
        }

        const siblings = current.parentElement
          ? Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName)
          : [];
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }

        parts.unshift(selector);
        current = current.parentElement;
        depth += 1;
      }

      return parts.join(" > ");
    }

    async captureViaPageBridge(payload) {
      this.ensurePageBridge();
      await this.waitForBridge();
      return this.requestCapture(payload);
    }

    async captureViaOfficialCapture(payload) {
      try {
        return await this.captureViaLocalApi(payload);
      } catch (localError) {
        try {
          return await this.captureViaPageBridge(payload);
        } catch (bridgeError) {
          const message = `Local capture failed: ${this.getErrorMessage(localError)}; bridge capture failed: ${this.getErrorMessage(bridgeError)}`;
          throw new Error(message);
        }
      }
    }

    async prewarmCapturePipeline() {
      try {
        await this.captureViaOfficialCapture({
          action: "prepare",
          ackTimeoutMs: 2500,
        });
      } catch (error) {
        const figmaKeys = window.figma ? Object.keys(window.figma) : [];
        console.warn("html-to-figma: prewarm failed", {
          error: this.getErrorMessage(error),
          hasFigmaObject: Boolean(window.figma),
          figmaKeys,
          hasCaptureForDesign:
            Boolean(window.figma) && typeof window.figma.captureForDesign === "function",
        });
      }
    }

    async captureViaLocalApi(payload) {
      const capture = await this.waitForLocalCaptureApi();
      if (payload && payload.action === "prepare") {
        return {
          ok: true,
          prepared: true,
          pending: false,
          scriptSource: "content",
        };
      }

      if (window.figma) {
        const useHtmlClipboardEncoding =
          !payload || payload.useHtmlClipboardEncoding !== false;
        window.figma.useHtmlClipboardEncoding = useHtmlClipboardEncoding;
      }
      const options = this.normalizeCaptureOptions(payload);
      const capturePromise = Promise.resolve(capture(options));
      const ack = await this.awaitCaptureAck(capturePromise, payload.ackTimeoutMs);

      return {
        ok: true,
        pending: ack.pending,
        selector: options.selector,
        mode: options.endpoint ? "file" : "clipboard",
        scriptSource: "content",
        value: ack.value,
      };
    }

    waitForLocalCaptureApi() {
      const deadline = Date.now() + LOCAL_CAPTURE_API_TIMEOUT_MS;
      return new Promise((resolve, reject) => {
        const check = () => {
          if (window.figma && typeof window.figma.captureForDesign === "function") {
            resolve(window.figma.captureForDesign.bind(window.figma));
            return;
          }
          if (Date.now() >= deadline) {
            reject(new Error("window.figma.captureForDesign unavailable"));
            return;
          }
          window.requestAnimationFrame(check);
        };
        check();
      });
    }

    normalizeCaptureOptions(payload) {
      const selector =
        payload && typeof payload.selector === "string" && payload.selector.trim()
          ? payload.selector
          : "body";
      const delayMs =
        payload && Number.isFinite(payload.delayMs) && payload.delayMs >= 0
          ? payload.delayMs
          : 0;
      const verbose = Boolean(payload && payload.verbose);
      const endpoint =
        payload && typeof payload.endpoint === "string" && payload.endpoint.trim()
          ? payload.endpoint.trim()
          : "";
      const captureId =
        payload && typeof payload.captureId === "string" && payload.captureId.trim()
          ? payload.captureId.trim()
          : "";

      const options = { selector, delayMs, verbose };
      if (endpoint) {
        options.endpoint = endpoint;
        if (captureId) {
          options.captureId = captureId;
        }
      }
      return options;
    }

    async awaitCaptureAck(capturePromise, ackTimeoutMs) {
      const timeout = Number.isFinite(ackTimeoutMs) && ackTimeoutMs > 0 ? ackTimeoutMs : CAPTURE_ACK_TIMEOUT_MS;
      const settled = await Promise.race([
        capturePromise.then(
          (value) => ({ state: "resolved", value }),
          (error) => ({ state: "rejected", error })
        ),
        new Promise((resolve) => {
          window.setTimeout(() => resolve({ state: "pending" }), timeout);
        }),
      ]);

      if (settled.state === "rejected") {
        throw new Error(this.getErrorMessage(settled.error));
      }

      if (settled.state === "resolved") {
        if (settled.value && settled.value.success === false) {
          throw new Error(this.getErrorMessage(settled.value.error || "Figma capture reported failure"));
        }
        return { pending: false, value: settled.value || null };
      }

      capturePromise.catch((error) => {
        console.warn("html-to-figma: capture async error after ack", error);
      });
      return { pending: true, value: null };
    }

    getErrorMessage(error) {
      if (!error) {
        return "Unknown error";
      }
      if (typeof error === "string") {
        return error;
      }
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return String(error);
    }

    ensurePageBridge() {
      if (this.bridgeReady) {
        return;
      }

      if (document.getElementById(BRIDGE_SCRIPT_ID)) {
        this.bridgeReady = Boolean(window.__HTML_TO_FIGMA_PAGE_BRIDGE_READY__);
        return;
      }

      const script = document.createElement("script");
      script.id = BRIDGE_SCRIPT_ID;
      script.src = chrome.runtime.getURL("src/page-bridge.js");
      script.async = false;
      script.dataset.captureUrl = CAPTURE_URL;
      script.dataset.captureLocalUrl = CAPTURE_LOCAL_URL;
      script.onload = () => {
        this.bridgeReady = true;
      };
      script.onerror = () => {
        script.remove();
        this.bridgeReady = false;
      };
      (document.head || document.documentElement).appendChild(script);
    }

    waitForBridge() {
      if (this.bridgeReady) {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const deadline = window.setTimeout(() => {
          reject(new Error("Bridge load timeout"));
        }, 1600);

        const checkReady = () => {
          if (this.bridgeReady || window.__HTML_TO_FIGMA_PAGE_BRIDGE_READY__) {
            window.clearTimeout(deadline);
            this.bridgeReady = true;
            resolve();
            return;
          }
          window.requestAnimationFrame(checkReady);
        };

        checkReady();
      });
    }

    requestCapture(payload) {
      return new Promise((resolve, reject) => {
        const requestId = `h2f-${Date.now()}-${this.requestCounter++}`;
        const responseEvent = "HTML_TO_FIGMA_CAPTURE_RESPONSE";
        const requestEvent = "HTML_TO_FIGMA_CAPTURE_REQUEST";

        const timeoutId = window.setTimeout(() => {
          document.removeEventListener(responseEvent, onResponse);
          reject(new Error("Capture request timeout"));
        }, 10000);

        const onResponse = (event) => {
          const detail = event.detail || {};
          if (detail.requestId !== requestId) {
            return;
          }

          window.clearTimeout(timeoutId);
          document.removeEventListener(responseEvent, onResponse);

          if (detail.ok) {
            resolve(detail.result);
          } else {
            reject(new Error(detail.error || "Unknown capture error"));
          }
        };

        document.addEventListener(responseEvent, onResponse);
        document.dispatchEvent(
          new CustomEvent(requestEvent, {
            detail: { requestId, payload },
          })
        );
      });
    }

    async copyPayloadToClipboard(payload) {
      const text = JSON.stringify(payload, null, 2);
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return;
      }

      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }

    isTypingContext(target) {
      if (!(target instanceof Element)) {
        return false;
      }
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    }

    setStatus(message, ttlMs = 0) {
      this.statusMessage = message;
      this.updateUi();
      this.clearStatusTimer();

      if (ttlMs > 0) {
        this.statusTimeout = window.setTimeout(() => {
          this.statusMessage = "Idle";
          this.updateUi();
          this.statusTimeout = null;
        }, ttlMs);
      }
    }

    clearStatusTimer() {
      if (this.statusTimeout) {
        window.clearTimeout(this.statusTimeout);
        this.statusTimeout = null;
      }
    }

    buildCopiedToastText(count) {
      return `copied ${count} item. Now paste in Figma`;
    }

    showLoadingToast(message) {
      this.showToastInternal(message, { loading: true, ttlMs: 0 });
    }

    showToast(message, ttlMs = 1800) {
      this.showToastInternal(message, { loading: false, ttlMs });
    }

    showToastInternal(message, options) {
      if (!TOP_TOAST_ENABLED) {
        return;
      }
      if (!this.toastEl) {
        return;
      }
      const loading = Boolean(options && options.loading);
      const ttlMs = options && Number.isFinite(options.ttlMs) ? options.ttlMs : 1800;

      this.clearToastTimer();
      if (this.toastTextEl) {
        this.toastTextEl.textContent = message;
      } else {
        this.toastEl.textContent = message;
      }
      this.toastEl.classList.toggle("loading", loading);
      this.toastEl.style.display = "flex";
      this.toastEl.offsetHeight;
      this.toastEl.classList.add("show");

      if (ttlMs > 0) {
        this.toastTimeout = window.setTimeout(() => {
          if (!this.toastEl) {
            return;
          }
          this.toastEl.classList.remove("show");
          const hideLater = window.setTimeout(() => {
            if (this.toastEl) {
              this.toastEl.style.display = "none";
              this.toastEl.classList.remove("loading");
            }
            this.toastTimeout = null;
          }, 160);
          this.toastTimeout = hideLater;
        }, ttlMs);
      }
    }

    clearToastTimer() {
      if (this.toastTimeout) {
        window.clearTimeout(this.toastTimeout);
        this.toastTimeout = null;
      }
      if (this.toastEl) {
        this.toastEl.classList.remove("show");
        this.toastEl.classList.remove("loading");
        this.toastEl.style.display = "none";
      }
    }
  }

  const inspector = new HtmlToFigmaInspector();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === MESSAGE_SET_ENABLED) {
      const state = inspector.setEnabled(Boolean(message.enabled));
      sendResponse(state);
      return;
    }

    if (message.type === MESSAGE_TOGGLE) {
      const state = inspector.toggle();
      sendResponse(state);
    }
  });

  function syncInitialEnabledState() {
    chrome.runtime.sendMessage({ type: MESSAGE_GET_TAB_STATE }, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      const shouldEnable = Boolean(response && response.enabled);
      inspector.setEnabled(shouldEnable);
    });
  }

  syncInitialEnabledState();
})();
