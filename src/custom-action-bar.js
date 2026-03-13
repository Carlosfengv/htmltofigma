"use strict";

(() => {
  if (window.HtmlToFigmaActionBar) {
    return;
  }

  const ROOT_ID = "__html_to_figma_action_bar__";
  const DOCK_STORAGE_KEY = "h2f:toolbar-dock-position";
  const MOBILE_BREAKPOINT = 540;
  const TOP_OFFSET = 16;
  const BOTTOM_OFFSET = 16;
  const SWAP_VELOCITY_PX_PER_SEC = 500;
  const ICON_COLOR_DEFAULT = "rgba(255, 255, 255, 0.9)";
  const SPRING_STIFFNESS = 400;
  const SPRING_DAMPING = 28;
  const SPRING_MASS = 1;

  const ICONS = {
    capture:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path opacity="0.4" d="M22.2469 10.3424C22.2452 10.0638 22.2444 9.92444 22.1566 9.83722C22.0689 9.75 21.9289 9.75 21.649 9.75H2.35096C2.07108 9.75 1.93114 9.75 1.84339 9.83722C1.75563 9.92444 1.75478 10.0638 1.75307 10.3424C1.74999 10.8458 1.75 11.3787 1.75 11.9428V12.0572C1.74999 14.2479 1.74998 15.9686 1.93059 17.312C2.11568 18.6886 2.50272 19.7809 3.36091 20.6391C4.21911 21.4973 5.31137 21.8843 6.68802 22.0694C8.03144 22.25 9.7521 22.25 11.9428 22.25H12.0572C14.2479 22.25 15.9686 22.25 17.312 22.0694C18.6886 21.8843 19.7809 21.4973 20.6391 20.6391C21.4973 19.7809 21.8843 18.6886 22.0694 17.312C22.25 15.9686 22.25 14.2479 22.25 12.0572V11.9428C22.25 11.3787 22.25 10.8458 22.2469 10.3424Z" fill="currentColor"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M12.0559 1.75H11.9416H11.9416C9.75087 1.74999 8.03018 1.74998 6.68677 1.93059C5.31011 2.11568 4.21786 2.50272 3.35966 3.36091C2.50146 4.21911 2.11443 5.31137 1.92934 6.68802C1.88993 6.98118 1.85912 7.29229 1.83503 7.62234C1.8138 7.91313 1.80319 8.05853 1.89219 8.15427C1.9812 8.25 2.12969 8.25 2.42667 8.25H21.5708C21.8678 8.25 22.0163 8.25 22.1053 8.15427C22.1943 8.05853 22.1837 7.91314 22.1625 7.62237V7.62234C22.1384 7.29229 22.1076 6.98118 22.0682 6.68802C21.8831 5.31137 21.496 4.21911 20.6378 3.36091C19.7796 2.50272 18.6874 2.11568 17.3107 1.93059C15.9673 1.74998 14.2466 1.74999 12.0559 1.75H12.0559ZM6 5C6 4.44772 6.44772 4 7 4H7.00898C7.56127 4 8.00898 4.44772 8.00898 5C8.00898 5.55228 7.56127 6 7.00898 6H7C6.44772 6 6 5.55228 6 5ZM11 4C10.4477 4 10 4.44772 10 5C10 5.55228 10.4477 6 11 6H11.009C11.5613 6 12.009 5.55228 12.009 5C12.009 4.44772 11.5613 4 11.009 4H11Z" fill="currentColor"></path></svg>',
    select:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path opacity="0.4" d="M17.9706 9.52977C17.909 9.55921 17.8457 9.58602 17.7808 9.61004C16.7751 9.98217 15.9822 10.7751 15.6101 11.7807C15.2834 12.6637 14.4414 13.2499 13.4999 13.2499C12.5584 13.2499 11.7165 12.6637 11.3898 11.7807C11.0176 10.7751 10.2248 9.98217 9.21911 9.61004C8.33613 9.28331 7.74994 8.44137 7.74994 7.49988C7.74994 6.55839 8.33613 5.71644 9.21911 5.38971C10.1305 5.05247 10.8671 4.36963 11.2742 3.49604C10.4843 2.77803 9.79987 2.17561 9.18605 1.78803C8.4407 1.31739 7.6368 1.06101 6.76527 1.41567C5.89534 1.76969 5.49574 2.5138 5.28479 3.37132C5.08515 4.18282 5.01347 5.26281 4.92859 6.5417L4.35662 14.3722C4.29194 15.2476 4.23929 15.9601 4.25179 16.5088C4.26404 17.0469 4.33686 17.607 4.68049 18.0404C5.05454 18.5123 5.60296 18.8135 6.20231 18.8737C6.75449 18.9293 7.26418 18.6845 7.71966 18.4024C8.18436 18.1146 8.74996 17.6828 9.44413 17.1528C9.76043 16.9113 9.98824 16.7385 10.1403 16.644C10.2203 16.593 10.4038 16.5419 10.498 16.7457C10.5807 16.9057 10.673 17.1334 10.8216 17.5039L12.3123 21.2202C12.391 21.4165 12.4634 21.5971 12.5344 21.7445C12.6107 21.9028 12.7078 22.0722 12.8559 22.2247C13.1793 22.5574 13.6223 22.7474 14.0869 22.7505C14.3002 22.752 14.4898 22.7043 14.6565 22.6493C14.8115 22.5982 15.0312 22.5088 15.2259 22.4296C15.4206 22.3504 15.6001 22.2773 15.7468 22.2056C15.9047 22.1285 16.0735 22.0303 16.2251 21.8809C16.5553 21.5553 16.7418 21.1116 16.7449 20.6485C16.7463 20.4362 16.6995 20.247 16.6451 20.0797C16.5946 19.9239 16.5222 19.7435 16.4434 19.5471L14.9527 15.8308C14.8041 15.4604 14.7134 15.232 14.6625 15.0589C14.6396 14.963 14.6457 14.7622 14.8536 14.7259C15.0279 14.6875 15.3109 14.6525 15.705 14.6048C16.5697 14.5004 17.2746 14.4152 17.8076 14.2971C18.331 14.1811 18.8653 14.0003 19.2226 13.576C19.6102 13.1156 19.7962 12.5182 19.7401 11.9191C19.6884 11.368 19.3547 10.9138 18.9915 10.5172C18.7278 10.2291 18.3827 9.90436 17.9706 9.52977Z" fill="currentColor"></path><path d="M13.5 3.25012C13.8138 3.25012 14.0945 3.44552 14.2034 3.73984C14.7274 5.15607 15.844 6.27268 17.2603 6.79673C17.5546 6.90564 17.75 7.18629 17.75 7.50012C17.75 7.81395 17.5546 8.0946 17.2603 8.20351C15.844 8.72756 14.7274 9.84417 14.2034 11.2604C14.0945 11.5547 13.8138 11.7501 13.5 11.7501C13.1862 11.7501 12.9055 11.5547 12.7966 11.2604C12.2726 9.84417 11.156 8.72756 9.73972 8.20351C9.4454 8.0946 9.25 7.81395 9.25 7.50012C9.25 7.18629 9.4454 6.90564 9.73972 6.79673C11.156 6.27268 12.2726 5.15607 12.7966 3.73984C12.9055 3.44552 13.1862 3.25012 13.5 3.25012Z" fill="currentColor"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M17.75 1.25012C18.0638 1.25012 18.3445 1.44552 18.4534 1.73984C18.5917 2.11367 18.8865 2.40841 19.2603 2.54673C19.5546 2.65564 19.75 2.93629 19.75 3.25012C19.75 3.56395 19.5546 3.8446 19.2603 3.95351C18.8865 4.09184 18.5917 4.38658 18.4534 4.7604C18.3445 5.05473 18.0638 5.25012 17.75 5.25012C17.4362 5.25012 17.1555 5.05473 17.0466 4.7604C16.9083 4.38658 16.6135 4.09184 16.2397 3.95351C15.9454 3.8446 15.75 3.56395 15.75 3.25012C15.75 2.93629 15.9454 2.65564 16.2397 2.54673C16.6135 2.40841 16.9083 2.11367 17.0466 1.73984C17.1555 1.44552 17.4362 1.25012 17.75 1.25012Z" fill="currentColor"></path></svg>',
    open:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"></path><path d="M10 14L20 4"></path><path d="M20 13v6a1 1 0 0 1-1 1h-14a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1h6"></path></svg>',
    close:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12"></path><path d="M18 6L6 18"></path></svg>',
    check:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4.2 4.2L19 6.5"></path></svg>',
    error:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5"></path><circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none"></circle><path d="M10.2 3.8L2.8 16.6a2 2 0 0 0 1.7 3h14.9a2 2 0 0 0 1.7-3L13.8 3.8a2 2 0 0 0-3.6 0z"></path></svg>',
    dot:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="2.3"></circle></svg>',
  };

  function applyStyles(node, styles) {
    Object.assign(node.style, styles);
  }

  function createIcon(key, color) {
    const span = document.createElement("span");
    span.setAttribute("aria-hidden", "true");
    span.className = "icon";
    span.innerHTML = ICONS[key] || ICONS.dot;
    span.style.color = color || ICON_COLOR_DEFAULT;
    return span;
  }

  class HtmlToFigmaActionBar {
    constructor() {
      this.host = null;
      this.shadowRoot = null;
      this.wrapper = null;
      this.bar = null;
      this.actionsContainer = null;
      this.resizeHandler = this.updateResponsiveLayout.bind(this);
      this.onPointerMove = this.handlePointerMove.bind(this);
      this.onPointerUp = this.handlePointerUp.bind(this);
      this.onKeyDown = this.handleKeyDown.bind(this);
      this.state = null;
      this.dockPosition = this.readDockPosition();
      this.dragging = false;
      this.dragData = null;
      this.releaseAnimationFrame = null;
      this.lastEscapeTapAt = 0;
    }

    mount() {
      if (this.host) {
        return;
      }

      this.host = document.createElement("div");
      this.host.id = ROOT_ID;
      applyStyles(this.host, {
        position: "fixed",
        inset: "0",
        pointerEvents: "none",
        zIndex: "2147483647",
      });

      this.shadowRoot = this.host.attachShadow({ mode: "closed" });

      const style = document.createElement("style");
      style.textContent = `
        :host { all: initial; }
        @keyframes h2f-spin { to { transform: rotate(360deg); } }
        @keyframes h2f-pop {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        .wrapper {
          position: fixed;
          left: 50%;
          top: ${TOP_OFFSET}px;
          transform: translateX(-50%);
          pointer-events: none;
          z-index: 2147483647;
        }
        .bar {
          display: flex;
          align-items: center;
          width: max-content;
          min-width: 265px;
          height: 40px;
          padding: 0 8px;
          border-radius: 13px;
          background: #2c2c2c;
          color: rgba(255, 255, 255, 0.9);
          box-shadow: 0 1px 3px 0 rgba(0,0,0,.15),0 0 .5px 0 rgba(0,0,0,.3);
          box-sizing: border-box;
          font-family: "Inter",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
          font-size: 12px;
          font-weight: 500;
          line-height: 16px;
          letter-spacing: 0.005em;
          pointer-events: auto;
          user-select: none;
          gap: 8px;
          cursor: grab;
          animation: h2f-pop .3s ease-out;
          transition: top 220ms ease, bottom 220ms ease, left 220ms ease, transform 220ms ease;
          overflow: hidden;
          position: relative;
        }
        .bar.dragging {
          cursor: grabbing;
          transition: none;
        }
        .message {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.9);
          white-space: nowrap;
          padding-left: 4px;
          padding-right: 12px;
          flex-grow: 1;
        }
        .divider {
          width: 1px;
          align-self: stretch;
          background: rgba(255, 255, 255, 0.14);
          flex-shrink: 0;
        }
        .actions {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-left: 8px;
          margin-right: 8px;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          height: 24px;
          padding: 0 8px 0 4px;
          border: none;
          border-radius: 5px;
          background: transparent;
          color: rgba(255, 255, 255, 0.9);
          cursor: pointer;
          font: inherit;
          transition: background .1s;
          white-space: nowrap;
        }
        .btn:hover { background: rgba(255, 255, 255, 0.1); }
        .btn:active { background: rgba(255, 255, 255, 0.15); }
        .btn-close {
          width: 24px;
          height: 24px;
          padding: 0;
          margin-left: 8px;
        }
        .label {
          display: inline-block;
          margin-left: 4px;
        }
        .icon {
          display: inline-flex;
          width: 16px;
          height: 16px;
          align-items: center;
          justify-content: center;
        }
        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: h2f-spin 0.9s linear infinite;
        }
      `;

      this.wrapper = document.createElement("div");
      this.wrapper.className = "wrapper";

      this.bar = document.createElement("div");
      this.bar.className = "bar";
      this.bar.addEventListener("mousedown", (event) => this.handlePointerDown(event));
      this.bar.addEventListener("touchstart", (event) => this.handlePointerDown(event), { passive: false });

      this.wrapper.appendChild(this.bar);
      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(this.wrapper);
      document.documentElement.appendChild(this.host);

      window.addEventListener("resize", this.resizeHandler);
      document.addEventListener("keydown", this.onKeyDown, true);
      this.applyDockPosition(this.dockPosition);
    }

    unmount() {
      window.removeEventListener("resize", this.resizeHandler);
      document.removeEventListener("keydown", this.onKeyDown, true);
      this.detachDragListeners();
      if (this.releaseAnimationFrame !== null) {
        cancelAnimationFrame(this.releaseAnimationFrame);
        this.releaseAnimationFrame = null;
      }
      if (this.host && this.host.parentNode) {
        this.host.parentNode.removeChild(this.host);
      }
      this.host = null;
      this.shadowRoot = null;
      this.wrapper = null;
      this.bar = null;
      this.actionsContainer = null;
      this.state = null;
      this.dragData = null;
      this.dragging = false;
      this.lastEscapeTapAt = 0;
    }

    setState(nextState) {
      this.mount();
      this.state = nextState;
      this.render();
    }

    render() {
      if (!this.bar || !this.state) {
        return;
      }

      const state = this.state;
      this.bar.replaceChildren();
      this.actionsContainer = null;

      const hasIcon = Boolean(state.icon);
      const hasActions = Boolean(state.actions && state.actions.length > 0);
      const hasClose = typeof state.onClose === "function";

      const message = document.createElement("span");
      message.className = "message";
      if (state.variant === "main") {
        message.style.paddingLeft = "4px";
        message.style.paddingRight = "12px";
      } else {
        message.style.paddingLeft = hasIcon ? "4px" : "8px";
        message.style.paddingRight = !hasActions && !hasClose ? "8px" : "4px";
      }

      if (state.icon === "spinner") {
        const spinner = document.createElement("span");
        spinner.className = "spinner";
        message.appendChild(spinner);
      } else if (state.icon === "ok") {
        message.appendChild(createIcon("check", "#31d07d"));
      } else if (state.icon === "error") {
        message.appendChild(createIcon("error", "#ff6b6b"));
      }

      const text = document.createElement("span");
      text.textContent = state.message || "";
      message.appendChild(text);
      this.bar.appendChild(message);

      if (hasActions) {
        this.bar.appendChild(this.createDivider());
        const actions = document.createElement("div");
        actions.className = "actions";
        this.actionsContainer = actions;
        for (const action of state.actions) {
          actions.appendChild(this.createButton(action));
        }
        this.bar.appendChild(actions);
      }

      if (hasClose) {
        this.bar.appendChild(this.createDivider());
        this.bar.appendChild(
          this.createButton({
            icon: "close",
            label: "Close",
            iconOnly: true,
            className: "btn-close",
            onClick: state.onClose,
          })
        );
      }

      this.updateResponsiveLayout();
    }

    createDivider() {
      const divider = document.createElement("div");
      divider.className = "divider";
      return divider;
    }

    createButton(config) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `btn ${config.className || ""}`.trim();
      button.title = config.label || "";
      if (!config.iconOnly) {
        button.setAttribute("data-icon-button", "");
      }
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof config.onClick === "function") {
          config.onClick();
        }
      });

      button.appendChild(createIcon(config.icon || "dot", ICON_COLOR_DEFAULT));

      if (!config.iconOnly) {
        const label = document.createElement("span");
        label.className = "label";
        label.setAttribute("data-toolbar-label", "");
        label.textContent = config.label || "";
        button.appendChild(label);
      }

      return button;
    }

    updateResponsiveLayout() {
      if (!this.bar) {
        return;
      }
      const compact = window.innerWidth < MOBILE_BREAKPOINT;
      const targetMinWidth = compact ? "265px" : `${this.getDesiredMinWidth()}px`;
      if (this.actionsContainer) {
        for (const label of this.actionsContainer.querySelectorAll("[data-toolbar-label]")) {
          label.style.display = compact ? "none" : "";
        }
        for (const iconButton of this.actionsContainer.querySelectorAll("[data-icon-button]")) {
          iconButton.style.padding = compact ? "0 4px" : "0 8px 0 4px";
        }
      }
      this.bar.style.minWidth = targetMinWidth;

      if (!this.dragging) {
        this.applyDockPosition(this.dockPosition);
      }
    }

    readDockPosition() {
      try {
        const value = window.localStorage.getItem(DOCK_STORAGE_KEY);
        return value === "bottom" || value === "top" ? value : "top";
      } catch (_error) {
        return "top";
      }
    }

    saveDockPosition(position) {
      try {
        window.localStorage.setItem(DOCK_STORAGE_KEY, position);
      } catch (_error) {
        // Ignore storage errors.
      }
    }

    getDesiredMinWidth() {
      if (!this.state) {
        return 265;
      }
      if (Number.isFinite(this.state.minWidth)) {
        return Math.max(265, this.state.minWidth);
      }
      return this.state.actions && this.state.actions.length >= 3 ? 490 : 265;
    }

    applyDockPosition(position) {
      if (!this.wrapper) {
        return;
      }
      this.dockPosition = position === "bottom" ? "bottom" : "top";
      this.saveDockPosition(this.dockPosition);
      this.wrapper.style.left = "50%";
      this.wrapper.style.transform = "translateX(-50%)";
      this.wrapper.style.bottom = this.dockPosition === "bottom" ? `${BOTTOM_OFFSET}px` : "";
      this.wrapper.style.top = this.dockPosition === "top" ? `${TOP_OFFSET}px` : "";
    }

    getPointerPoint(event) {
      if (event.touches && event.touches[0]) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }
      return { x: event.clientX, y: event.clientY };
    }

    handlePointerDown(event) {
      if (!this.bar || !this.wrapper) {
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest("button")) {
        return;
      }

      const point = this.getPointerPoint(event);
      const rect = this.wrapper.getBoundingClientRect();
      this.dragging = true;
      this.dragData = {
        startX: point.x,
        startY: point.y,
        startCenterX: rect.left + rect.width / 2,
        startTop: rect.top,
        lastY: point.y,
        lastTime: performance.now(),
        velocityY: 0,
      };

      this.bar.classList.add("dragging");
      if (this.releaseAnimationFrame !== null) {
        cancelAnimationFrame(this.releaseAnimationFrame);
        this.releaseAnimationFrame = null;
      }
      this.wrapper.style.top = `${rect.top}px`;
      this.wrapper.style.bottom = "";
      this.wrapper.style.left = `${this.dragData.startCenterX}px`;
      this.wrapper.style.transform = "translateX(-50%)";
      this.wrapper.style.transition = "none";

      this.attachDragListeners();
      if (event.cancelable) {
        event.preventDefault();
      }
    }

    handlePointerMove(event) {
      if (!this.dragging || !this.dragData || !this.wrapper) {
        return;
      }

      const point = this.getPointerPoint(event);
      const dx = point.x - this.dragData.startX;
      const dy = point.y - this.dragData.startY;
      const now = performance.now();
      const elapsed = Math.max(1, now - this.dragData.lastTime);
      this.dragData.velocityY = ((point.y - this.dragData.lastY) / elapsed) * 1000;
      this.dragData.lastY = point.y;
      this.dragData.lastTime = now;

      const nextCenterX = this.dragData.startCenterX + dx;
      const nextRawTop = this.dragData.startTop + dy;
      const topBound = -20;
      const bottomBound = window.innerHeight - 20 - 40;
      let nextTop = nextRawTop;
      if (nextRawTop < 0) {
        nextTop = nextRawTop * 0.3;
      } else if (nextRawTop > bottomBound) {
        const overflow = nextRawTop - bottomBound;
        nextTop = bottomBound + overflow * 0.3;
      } else {
        nextTop = Math.max(topBound, Math.min(bottomBound, nextRawTop));
      }

      this.wrapper.style.left = `${nextCenterX}px`;
      this.wrapper.style.top = `${nextTop}px`;

      if (event.cancelable) {
        event.preventDefault();
      }
    }

    handlePointerUp() {
      if (!this.dragging || !this.wrapper) {
        return;
      }
      const velocityY = this.dragData ? this.dragData.velocityY : 0;
      const currentTop = this.wrapper.getBoundingClientRect().top;
      const preferBottom =
        velocityY > SWAP_VELOCITY_PX_PER_SEC ||
        (Math.abs(velocityY) <= SWAP_VELOCITY_PX_PER_SEC &&
          currentTop > window.innerHeight / 2);

      this.dragging = false;
      this.dragData = null;
      if (this.bar) {
        this.bar.classList.remove("dragging");
      }
      const targetDock = preferBottom ? "bottom" : "top";
      this.saveDockPosition(targetDock);
      this.springToDock(targetDock, velocityY);
      this.detachDragListeners();
    }

    springToDock(targetDock, initialVelocityY) {
      if (!this.wrapper) {
        return;
      }
      const targetCenterX = window.innerWidth / 2;
      const targetTop = targetDock === "top" ? TOP_OFFSET : window.innerHeight - 40 - BOTTOM_OFFSET;
      let currentCenterX = parseFloat(this.wrapper.style.left) || targetCenterX;
      let currentTop = parseFloat(this.wrapper.style.top) || targetTop;
      let velocityX = 0;
      let velocityY = Number.isFinite(initialVelocityY) ? initialVelocityY : 0;
      let lastTs = performance.now();
      this.wrapper.style.transition = "none";

      const tick = (ts) => {
        if (!this.wrapper) {
          this.releaseAnimationFrame = null;
          return;
        }
        const dt = Math.min((ts - lastTs) / 1000, 0.05);
        lastTs = ts;

        const forceX = -SPRING_STIFFNESS * (currentCenterX - targetCenterX) - SPRING_DAMPING * velocityX;
        const forceY = -SPRING_STIFFNESS * (currentTop - targetTop) - SPRING_DAMPING * velocityY;
        const accX = forceX / SPRING_MASS;
        const accY = forceY / SPRING_MASS;
        velocityX += accX * dt;
        velocityY += accY * dt;
        currentCenterX += velocityX * dt;
        currentTop += velocityY * dt;

        this.wrapper.style.left = `${currentCenterX}px`;
        this.wrapper.style.top = `${currentTop}px`;
        this.wrapper.style.bottom = "";
        this.wrapper.style.transform = "translateX(-50%)";

        const stableX = Math.abs(currentCenterX - targetCenterX) < 0.5 && Math.abs(velocityX) < 10;
        const stableY = Math.abs(currentTop - targetTop) < 0.5 && Math.abs(velocityY) < 10;
        if (stableX && stableY) {
          this.releaseAnimationFrame = null;
          this.applyDockPosition(targetDock);
          return;
        }

        this.releaseAnimationFrame = requestAnimationFrame(tick);
      };

      this.releaseAnimationFrame = requestAnimationFrame(tick);
    }

    handleKeyDown(event) {
      if (!this.state || typeof this.state.onClose !== "function") {
        return;
      }
      if (event.key !== "Escape") {
        return;
      }
      const now = Date.now();
      if (now - this.lastEscapeTapAt <= 500) {
        this.lastEscapeTapAt = 0;
        event.preventDefault();
        event.stopPropagation();
        this.state.onClose();
        return;
      }
      this.lastEscapeTapAt = now;
    }

    attachDragListeners() {
      window.addEventListener("mousemove", this.onPointerMove, true);
      window.addEventListener("mouseup", this.onPointerUp, true);
      window.addEventListener("touchmove", this.onPointerMove, { passive: false, capture: true });
      window.addEventListener("touchend", this.onPointerUp, true);
      window.addEventListener("touchcancel", this.onPointerUp, true);
    }

    detachDragListeners() {
      window.removeEventListener("mousemove", this.onPointerMove, true);
      window.removeEventListener("mouseup", this.onPointerUp, true);
      window.removeEventListener("touchmove", this.onPointerMove, true);
      window.removeEventListener("touchend", this.onPointerUp, true);
      window.removeEventListener("touchcancel", this.onPointerUp, true);
    }
  }

  window.HtmlToFigmaActionBar = HtmlToFigmaActionBar;
})();
