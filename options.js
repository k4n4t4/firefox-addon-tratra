"use strict";

const DEFAULT_COMBO = { ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, code: "KeyY" };
const DEFAULT_TRANSLATE_CONFIG = { sourceLang: "en", pivotLang: "ja", targetLang: "en", waitMs: 1500 };

const box = document.getElementById("combo-box");
const warn = document.getElementById("warn");
const saveBtn = document.getElementById("save");
const resetBtn = document.getElementById("reset");
const status = document.getElementById("status");

const sourceLangEl = document.getElementById("source-lang");
const pivotLangEl = document.getElementById("pivot-lang");
const targetLangEl = document.getElementById("target-lang");
const waitMsEl = document.getElementById("wait-ms");

let pending = null;
let recording = false;
let pendingTranslateConfig = { ...DEFAULT_TRANSLATE_CONFIG };

function comboToText(c) {
    if (!c) return "";
    const parts = [];
    if (c.ctrlKey) parts.push("Ctrl");
    if (c.altKey) parts.push("Alt");
    if (c.shiftKey) parts.push("Shift");
    if (c.metaKey) parts.push("Cmd/Meta");
    let key = c.code || "";
    if (key.startsWith("Key")) key = key.slice(3);
    else if (key.startsWith("Digit")) key = key.slice(5);
    parts.push(key);
    return parts.join(" + ");
}

function isPrintableOnly(c) {
    return !(c.ctrlKey || c.altKey || c.shiftKey || c.metaKey);
}

function isReserved(c) {
    const combos = [
        { m: { ctrlKey: true }, codes: ["KeyT", "KeyW", "KeyN", "KeyL", "KeyK", "KeyJ", "KeyR", "KeyQ", "KeyU", "KeyD", "KeyP", "KeyS", "KeyF", "KeyG", "KeyH", "KeyE", "KeyA", "KeyC", "KeyV", "KeyX", "KeyZ", "Tab", "PageUp", "PageDown", "F4", "F5"] },
        { m: { ctrlKey: true, shiftKey: true }, codes: ["KeyT", "KeyN", "KeyQ", "KeyW", "KeyP", "Tab"] },
        { m: { altKey: true }, codes: ["Home", "ArrowLeft", "ArrowRight", "F4"] },
        { m: { metaKey: true }, codes: ["KeyT", "KeyW", "KeyN", "KeyQ", "KeyL", "KeyR", "KeyC", "KeyV", "KeyX", "Tab"] }
    ];
    return combos.some(({ m, codes }) =>
        Object.entries(m).every(([k, v]) => c[k] === v) && codes.includes(c.code)
    );
}

function showWarn(msg) {
    if (msg) {
        warn.textContent = msg;
        warn.classList.add("show");
    } else {
        warn.classList.remove("show");
    }
}

function setStatus() {
    status.classList.add("show");
    setTimeout(() => status.classList.remove("show"), 1800);
}

box.addEventListener("click", () => {
    recording = true;
    pending = null;
    box.value = "";
    box.placeholder = "キーを入力してください…";
    box.classList.add("recording");
    box.classList.remove("invalid");
    showWarn("");
    box.focus();
});

box.addEventListener("keydown", (e) => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();

    if (["ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight"].includes(e.code)) {
        return;
    }

    const combo = {
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        code: e.code
    };

    if (isPrintableOnly(combo)) {
        box.classList.add("invalid");
        box.value = comboToText(combo);
        showWarn("修飾キー（Ctrl / Alt / Shift / Meta）との組み合わせが必要です。");
        return;
    }

    pending = combo;
    box.value = comboToText(combo);
    box.classList.remove("invalid", "recording");
    recording = false;
    box.blur();

    if (isReserved(combo)) {
        showWarn("この組み合わせはブラウザが予約しているため、正しく動作しない可能性があります。");
    } else {
        showWarn("");
    }
});

box.addEventListener("blur", () => {
    if (recording) {
        recording = false;
        box.classList.remove("recording");
        if (!pending) {
            loadCurrent();
        }
    }
});

function readTranslateConfigFromUI() {
    const waitMs = Number(waitMsEl.value);
    return {
        sourceLang: sourceLangEl.value || "en",
        pivotLang: pivotLangEl.value || "ja",
        targetLang: targetLangEl.value || "en",
        waitMs: Number.isFinite(waitMs) && waitMs >= 0 ? Math.floor(waitMs) : 1500
    };
}

function applyTranslateConfigToUI(cfg) {
    const c = cfg || DEFAULT_TRANSLATE_CONFIG;
    sourceLangEl.value = c.sourceLang || "en";
    pivotLangEl.value = c.pivotLang || "ja";
    targetLangEl.value = c.targetLang || "en";
    waitMsEl.value = typeof c.waitMs === "number" ? c.waitMs : 1500;
}

saveBtn.addEventListener("click", async () => {
    if (!pending) {
        showWarn("まずショートカットキーを入力してください。");
        return;
    }
    const translateConfig = readTranslateConfigFromUI();
    pendingTranslateConfig = translateConfig;
    await browser.storage.local.set({ hotkey: pending, translateConfig: translateConfig });
    setStatus();
    showWarn("");
});

resetBtn.addEventListener("click", async () => {
    pending = { ...DEFAULT_COMBO };
    box.value = comboToText(pending);
    box.classList.remove("invalid");
    pendingTranslateConfig = { ...DEFAULT_TRANSLATE_CONFIG };
    applyTranslateConfigToUI(pendingTranslateConfig);
    showWarn("");
    await browser.storage.local.set({ hotkey: pending, translateConfig: pendingTranslateConfig });
    setStatus();
});

async function loadCurrent() {
    const res = await browser.storage.local.get(["hotkey", "translateConfig"]);
    pending = res.hotkey || { ...DEFAULT_COMBO };
    box.value = comboToText(pending);
    pendingTranslateConfig = res.translateConfig || { ...DEFAULT_TRANSLATE_CONFIG };
    applyTranslateConfigToUI(pendingTranslateConfig);
}

loadCurrent();
