"use strict";

const DEFAULT_TRANSLATE_CONFIG = { sourceLang: "en", pivotLang: "ja", targetLang: "en", waitMs: 1500 };

function extractTranslated(data) {
    if (!Array.isArray(data) || !Array.isArray(data[0])) return "";
    return data[0]
        .map((seg) => (Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : ""))
        .join("");
}

async function gtranslate(text, sl, tl, n = 0) {
    console.log("[tratra] gtranslate", sl, tl, n);
    const res = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=" + sl + "&tl=" + tl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "q=" + encodeURIComponent(text) });
    if (res.status === 429 && n < 3) { await new Promise((r) => setTimeout(r, 5000 * 2 ** n)); return gtranslate(text, sl, tl, n + 1); }
    if (!res.ok) throw new Error("HTTP " + res.status + " from translate endpoint");
    const out = extractTranslated(await res.json());
    if (!out) throw new Error("it is empty");
    return out;
}

async function translateThrough(text, sourceLang, pivotLang, targetLang, waitMs) {
    const mid = await gtranslate(text, sourceLang, pivotLang);
    if (typeof waitMs === "number" && waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
    }
    const out = await gtranslate(mid, pivotLang, targetLang);
    return { ok: true, mid: mid, result: out };
}

browser.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "translate-enjaen") return;
    return (async () => {
        const cfg = await browser.storage.local.get("translateConfig");
        const c = cfg.translateConfig || DEFAULT_TRANSLATE_CONFIG;
        const sourceLang = c.sourceLang || DEFAULT_TRANSLATE_CONFIG.sourceLang;
        const pivotLang = c.pivotLang || DEFAULT_TRANSLATE_CONFIG.pivotLang;
        const targetLang = c.targetLang || DEFAULT_TRANSLATE_CONFIG.targetLang;
        const waitMs = typeof c.waitMs === "number" ? c.waitMs : DEFAULT_TRANSLATE_CONFIG.waitMs;
        return translateThrough(msg.text, sourceLang, pivotLang, targetLang, waitMs);
    })().catch((err) => {
        return { ok: false, error: String(err && err.message ? err.message : err) };
    });
});
