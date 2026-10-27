"use strict";

const DEFAULT_COMBO = { ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, code: "KeyY" };
let hotkey = { ...DEFAULT_COMBO };

browser.storage.local.get("hotkey").then((res) => {
    if (res.hotkey) hotkey = res.hotkey;
}).catch(() => { });

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.hotkey && changes.hotkey.newValue) {
        hotkey = changes.hotkey.newValue;
    }
});

function matchesHotkey(ev) {
    return (
        ev.ctrlKey === hotkey.ctrlKey &&
        ev.altKey === hotkey.altKey &&
        ev.shiftKey === hotkey.shiftKey &&
        ev.metaKey === hotkey.metaKey &&
        ev.code === hotkey.code
    );
}

function getEditableTarget(node) {
    if (!node) return null;
    const tag = node.tagName;
    if (tag === "TEXTAREA") return node;
    if (tag === "INPUT") {
        const t = (node.getAttribute("type") || "").toLowerCase();
        const textTypes = new Set(["text", "search", "url", "tel", "email", "password", "number", ""]);
        return textTypes.has(t) ? node : null;
    }
    if (node.isContentEditable) return node;
    return null;
}

function getSelectedTextWithin(target) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { text: "", range: null };
    const text = sel.toString();
    if (!text) return { text: "", range: null };
    const range = sel.getRangeAt(0);
    if (target.isContentEditable && !target.contains(range.commonAncestorContainer)) {
        return { text: "", range: null };
    }
    return { text, range: range.cloneRange() };
}

function replaceInEditable(target, savedRange, newText) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    if (target.isContentEditable) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
        try {
            document.execCommand("delete", false, null);
            document.execCommand("insertText", false, newText);
        } catch (e) {
            const r = sel.rangeCount ? sel.getRangeAt(0) : savedRange;
            r.deleteContents();
            r.insertNode(document.createTextNode(newText));
            const nr = document.createRange();
            nr.setStartAfter(r.endContainer);
            nr.collapse(true);
            sel.removeAllRanges();
            sel.addRange(nr);
        }
        target.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
        return true;
    }

    // input / textarea
    if (typeof target.selectionStart !== "number") return false;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    if (start === end) return false;
    if (typeof target.setRangeText === "function") {
        target.setRangeText(newText, start, end, "end");
    } else {
        const v = target.value;
        target.value = v.slice(0, start) + newText + v.slice(end);
        target.setSelectionRange(start + newText.length, start + newText.length);
    }
    target.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
}

document.addEventListener(
    "keydown",
    (ev) => {
        if (ev.isComposing || ev.keyCode === 229) return;

        if (!matchesHotkey(ev)) return;

        const target = getEditableTarget(ev.target);
        if (!target) return;

        const { text, range } = getSelectedTextWithin(target);
        if (!text) return;

        ev.preventDefault();
        ev.stopPropagation();

        browser.runtime
            .sendMessage({ type: "translate-enjaen", text })
            .then((res) => {
                if (!res || !res.ok) {
                    console.warn("[tratra] failed:", res && res.error);
                    return;
                }
                replaceInEditable(target, range, res.result);
            })
            .catch((err) => console.warn("[tratra] error:", err));
    },
    true
);
