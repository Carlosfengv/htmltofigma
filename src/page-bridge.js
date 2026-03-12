"use strict";

(() => {
  if (window.__HTML_TO_FIGMA_PAGE_BRIDGE_READY__) {
    return;
  }

  const currentScript = document.currentScript;
  const CAPTURE_URL =
    (currentScript && currentScript.dataset && currentScript.dataset.captureUrl) ||
    "https://mcp.figma.com/mcp/html-to-design/capture.js";
  const CAPTURE_LOCAL_URL =
    (currentScript && currentScript.dataset && currentScript.dataset.captureLocalUrl) || "";
  const REQUEST_EVENT = "HTML_TO_FIGMA_CAPTURE_REQUEST";
  const RESPONSE_EVENT = "HTML_TO_FIGMA_CAPTURE_RESPONSE";
  const CAPTURE_SCRIPT_ID = "__html_to_figma_capture_script__";
  const DEFAULT_ACK_TIMEOUT_MS = 1400;

  let captureScriptPromise = null;
  let captureScriptSource = "";

  function loadScript(url, scriptId) {
    if (!url) {
      return Promise.reject(new Error("Missing capture script url"));
    }
    return new Promise((resolve, reject) => {
      const existing = document.getElementById(scriptId);
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.id = scriptId;
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error(`Unable to load capture script: ${url}`));
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function ensureCaptureScript() {
    if (captureScriptPromise) {
      return captureScriptPromise;
    }

    captureScriptPromise = loadScript(CAPTURE_LOCAL_URL, CAPTURE_SCRIPT_ID)
      .then(() => {
        captureScriptSource = "local";
      })
      .catch(() =>
        loadScript(CAPTURE_URL, CAPTURE_SCRIPT_ID).then(() => {
          captureScriptSource = "remote";
        })
      );

    return captureScriptPromise;
  }

  function resolveOfficialCaptureApi() {
    const figma = window.figma;
    if (!figma || typeof figma.captureForDesign !== "function") {
      return null;
    }
    return figma.captureForDesign.bind(figma);
  }

  function normalizeCaptureOptions(payload) {
    const selector = typeof payload.selector === "string" && payload.selector.trim() ? payload.selector : "body";
    const delayMs = Number.isFinite(payload.delayMs) && payload.delayMs >= 0 ? payload.delayMs : 0;
    const verbose = Boolean(payload.verbose);
    const endpoint = typeof payload.endpoint === "string" && payload.endpoint.trim() ? payload.endpoint.trim() : "";
    const captureId =
      typeof payload.captureId === "string" && payload.captureId.trim() ? payload.captureId.trim() : "";

    const options = { selector, delayMs, verbose };
    if (endpoint) {
      options.endpoint = endpoint;
      if (captureId) {
        options.captureId = captureId;
      }
    }
    return options;
  }

  function asErrorMessage(error) {
    if (!error) {
      return "Unknown capture error";
    }
    if (typeof error === "string") {
      return error;
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return String(error);
  }

  async function awaitCaptureAck(capturePromise, ackTimeoutMs) {
    const timeout = Number.isFinite(ackTimeoutMs) && ackTimeoutMs > 0 ? ackTimeoutMs : DEFAULT_ACK_TIMEOUT_MS;
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
      throw new Error(asErrorMessage(settled.error));
    }

    if (settled.state === "resolved") {
      if (settled.value && settled.value.success === false) {
        throw new Error(asErrorMessage(settled.value.error || "Figma capture reported failure"));
      }
      return { pending: false, value: settled.value || null };
    }

    capturePromise.catch((error) => {
      console.warn("html-to-figma: captureForDesign async error after ack", error);
    });
    return { pending: true, value: null };
  }

  async function runCapture(payload) {
    await ensureCaptureScript();
    if (payload && payload.action === "prepare") {
      return {
        ok: true,
        prepared: true,
        scriptSource: captureScriptSource || "unknown",
      };
    }

    const capture = resolveOfficialCaptureApi();
    if (!capture) {
      throw new Error("capture.js loaded but window.figma.captureForDesign is unavailable");
    }

    if (window.figma) {
      window.figma.useHtmlClipboardEncoding = payload.useHtmlClipboardEncoding !== false;
    }

    const options = normalizeCaptureOptions(payload);
    const capturePromise = Promise.resolve(capture(options));
    const ack = await awaitCaptureAck(capturePromise, payload.ackTimeoutMs);

    return {
      ok: true,
      scriptSource: captureScriptSource || "unknown",
      pending: ack.pending,
      selector: options.selector,
      mode: options.endpoint ? "file" : "clipboard",
      value: ack.value,
    };
  }

  document.addEventListener(REQUEST_EVENT, async (event) => {
    const detail = event.detail || {};
    const requestId = detail.requestId;

    if (!requestId) {
      return;
    }

    try {
      const result = await runCapture(detail.payload || {});
      document.dispatchEvent(
        new CustomEvent(RESPONSE_EVENT, {
          detail: {
            requestId,
            ok: true,
            result,
          },
        })
      );
    } catch (error) {
      document.dispatchEvent(
        new CustomEvent(RESPONSE_EVENT, {
          detail: {
            requestId,
            ok: false,
            error: error && error.message ? error.message : "Unknown bridge error",
          },
        })
      );
    }
  });

  window.__HTML_TO_FIGMA_PAGE_BRIDGE_READY__ = true;
})();
