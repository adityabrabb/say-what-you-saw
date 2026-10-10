// Whole-film smoke test: camera roll -> credits, real mouse clicks on every button, hit-tested.
// usage (against a running production build):  npx next build && npx next start -p 3100
//   URL=http://localhost:3100/ node scripts/smoke.mjs [fake|denied|none|hang] [phone]
// CHROME=path/to/chrome overrides the browser. Plays the whole film with real, hit-tested mouse clicks and
// fails if any button is covered, never becomes clickable, or a scene never arrives.
import puppeteer from "puppeteer-core";
const camera = process.argv[2] || "fake";
const phone = process.argv[3] === "phone";
const URL = process.env.URL || "http://localhost:3100/";
const args = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"];
if (camera === "fake") args.push("--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream");
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args });
const page = await browser.newPage();
await page.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1366, height: 768 });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text().slice(0, 220)); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("requestfailed", (r) => errors.push("requestfailed: " + r.url().slice(0, 100) + " " + (r.failure()?.errorText || "")));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url().slice(0, 100)}`); });
if (camera === "hang") await page.evaluateOnNewDocument(() => { navigator.mediaDevices.getUserMedia = () => new Promise(() => {}); });
if (camera === "denied") await page.evaluateOnNewDocument(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError")); });
if (camera === "none") await page.evaluateOnNewDocument(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("none", "NotFoundError")); });

await page.evaluateOnNewDocument(() => { window.__spoke = 0; const ss = window.speechSynthesis; if (ss) { const o = ss.speak.bind(ss); ss.speak = (u) => { window.__spoke++; return o(u); }; } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const log = async (msg) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s] ${msg}  (${await page.$eval(".film-root", (e) => e.className.replace("film-root ", "")).catch(() => "?")})`);
const problems = [];

async function click(re, { timeout = 20000, label } = {}) {
  const t0 = Date.now();
  let lastHit = "";
  while (Date.now() - t0 < timeout) {
    const r = await page.evaluate((src) => {
      const re = new RegExp(src, "i");
      const vis = (b) => { let o = 1; for (let e = b; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
      for (const b of document.querySelectorAll("button,a")) {
        if (b.disabled || !re.test(b.textContent.trim())) continue;
        const cs = getComputedStyle(b);
        if (cs.visibility === "hidden" || cs.display === "none" || vis(b) < 0.3) continue;
        b.scrollIntoView({ block: "center" });
        const rc = b.getBoundingClientRect();
        if (rc.width < 2 || rc.height < 2) continue;
        const x = rc.x + rc.width / 2, y = rc.y + rc.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { x, y, ok: b === hit || b.contains(hit), hit: hit ? hit.tagName + "." + String(hit.className).slice(0, 40) : "none", text: b.textContent.trim() };
      }
      return null;
    }, re.source);
    if (r) {
      // Let the page settle after scrolling (score count-ups and images shift the layout), then measure again.
      await sleep(350);
      const again = await page.evaluate((src) => {
        const re = new RegExp(src, "i");
        for (const b of document.querySelectorAll("button,a")) {
          if (b.disabled || !re.test(b.textContent.trim())) continue;
          const rc = b.getBoundingClientRect();
          if (rc.width < 2 || rc.height < 2) continue;
          const x = rc.x + rc.width / 2, y = rc.y + rc.height / 2;
          const hit = document.elementFromPoint(x, y);
          return { x, y, ok: b === hit || b.contains(hit), hit: hit ? hit.tagName + "." + String(hit.className).slice(0, 40) : "none", text: b.textContent.trim() };
        }
        return null;
      }, re.source);
      if (!again) continue;
      Object.assign(r, again);
      if (!r.ok) { lastHit = r.hit; await sleep(250); continue; }
      if (phone) await page.touchscreen.tap(r.x, r.y);
      else await page.mouse.click(r.x, r.y);
      return r.text;
    }
    await sleep(200);
  }
  const why = lastHit ? `BLOCKED by ${lastHit}` : "never became clickable";
  problems.push(`${label || re}: ${why}`);
  throw new Error(`${label || re}: ${why}`);
}
const scene = () => page.$eval(".film-root", (e) => e.className).catch(() => "");
async function waitScene(name, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await scene()).includes(name)) return;
    await sleep(200);
  }
  problems.push(`never reached ${name} (stuck at ${await scene()})`);
  throw new Error(`never reached ${name}`);
}

// Layout checks after every step: horizontal overflow, text that is clipped or off-screen, overlapping
// text blocks, and layout shift (CLS). Problems are reported at the end.
await page.evaluateOnNewDocument(() => {
  window.__cls = 0; window.__shifts = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; if (e.value > 0.01) window.__shifts.push(`${e.value.toFixed(3)} @${Math.round(e.startTime / 1000)}s ` + (e.sources || []).map((x) => (x.node ? (x.node.tagName || "#text").toLowerCase() + "." + String(x.node.className || x.node.parentElement?.className || "").split(" ")[0] : "?")).join(", ")); } }).observe({ type: "layout-shift", buffered: true }); } catch {}
});
const layoutIssues = [];
let shotNo = 0;
async function checkLayout(label) {
  const res = await page.evaluate(() => {
    const out = [];
    const vw = innerWidth;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page is wider than the screen (${document.documentElement.scrollWidth} > ${vw})`);
    const visible = (e) => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; for (let n = e; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.2) return false; } return true; };
    const name = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : "");
    const texty = [...document.querySelectorAll("h1,h2,h3,p,button,a,label,span,li,blockquote,input,textarea")].filter((e) => visible(e) && (e.innerText || e.value || "").trim().length > 1 && !e.closest("canvas,svg,.cctv,.scene-stage,.credits-roll,.film-black"));
    for (const e of texty) {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      if (r.right > vw + 2 || r.left < -2) out.push(`text off-screen: ${name(e)} "${(e.innerText || "").trim().slice(0, 30)}"`);
      if (["hidden", "clip"].includes(cs.overflowX) && e.scrollWidth > e.clientWidth + 2 && cs.textOverflow !== "ellipsis" && e.tagName !== "INPUT") out.push(`text clipped sideways: ${name(e)} "${(e.innerText || "").trim().slice(0, 30)}"`);
      if (["hidden", "clip"].includes(cs.overflowY) && e.scrollHeight > e.clientHeight + 3 && e.tagName !== "TEXTAREA") out.push(`text clipped vertically: ${name(e)} "${(e.innerText || "").trim().slice(0, 30)}"`);
    }
    // overlap between independent, fixed or top-level text blocks (leaf-ish elements only)
    const leaves = texty.filter((e) => !e.querySelector("button,a,p,h1,h2,h3") && getComputedStyle(e).position !== "static" || /^(BUTTON|A|H1|H2|H3|P|LABEL)$/.test(e.tagName) && !e.querySelector("button,a,p,h1,h2,h3"));
    for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i], b = leaves[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 6 && oy > 6) {
        // ignore things stacked on purpose: layered pseudo-text, the film frame vs chrome in different z-layers is NOT ignored
        const za = getComputedStyle(a).position, zb = getComputedStyle(b).position;
        out.push(`overlap: ${name(a)} "${(a.innerText || "").trim().slice(0, 20)}" x ${name(b)} "${(b.innerText || "").trim().slice(0, 20)}" (${Math.round(ox)}x${Math.round(oy)})`);
      }
    }
    return out;
  }).catch(() => []);
  for (const r of res) layoutIssues.push(`[${label}] ${r}`);
}

// An act card also advances by itself, so "Skip then Action" may legitimately find the next scene already up.
async function card(next) {
  await click(/^(Skip|Action)/, { timeout: 25000 }).catch(async (e) => { if (!(await scene()).includes(next)) throw e; });
  if (!(await scene()).includes(next)) await click(/^Action/, { timeout: 8000 }).catch(async (e) => { if (!(await scene()).includes(next)) throw e; });
  await waitScene(next);
}
async function step(msg, fn) { try { await fn(); await checkLayout(msg); if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${String(++shotNo).padStart(2, "0")}-${msg.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.png` }); await log("OK  " + msg); } catch (e) { await log("FAIL " + msg + " :: " + e.message); throw e; } }

try {
  await page.goto(URL, { waitUntil: "networkidle2" });
  await step("black screen: click to roll the film", async () => { await page.mouse.click(phone ? 195 : 640, phone ? 420 : 360); });
  await step("title: Roll camera", async () => { await click(/Roll camera/); await waitScene("scene-cast"); });
  await step("cast: type name, That's me", async () => {
    await page.waitForSelector("#star-name");
    await page.click("#star-name", { clickCount: 3 });
    await page.keyboard.type("Smoke");
    await click(/That.s me/);
  });
  await step("Act I card: Skip, Action", async () => {
    await waitScene("scene-act1-card");
    await card("scene-act1");
  });
  await step("Recall: briefing Skip", async () => { await click(/^Skip$/); });
  await step("Recall: toggle sound chip", async () => {
    await click(/^[♪♪̸]/);
    await click(/^[♪♪̸]/);
  });
  await step("Recall: pick 3 rounds, Open the file", async () => { await click(/^3 rounds/); await click(/Open the file/); });
  for (let round = 1; round <= 3; round++) {
    await step(`Recall round ${round}: look, then File Statement`, async () => {
      await page.waitForSelector("textarea.statement", { timeout: 30000 });
      await page.type("textarea.statement", ["a dog chasing a red ball in a park", "two boats and a lighthouse", "a yellow car"][round - 1]);
      await click(/File Statement/);
    });
    await step(`Recall round ${round}: result -> ${round < 3 ? "Next round" : "Close the case"}`, async () => {
      const btn = round < 3 ? /Next round/ : /Close the case/;
      await click(btn, { timeout: 45000 });
      // The score animates in and can shift the layout under the pointer; a real user would just tap again.
      await sleep(1500);
      if ((await page.$("textarea.statement")) === null && round < 3 && (await page.$$eval("button", (b) => b.some((x) => /Next round/.test(x.textContent))))) {
        console.log("        (tap landed on a shifting layout, tapping again)");
        await click(btn, { timeout: 10000 });
      }
    });
  }
  await step("Recall final -> On to Act II", async () => { await click(/On to Act II/, { timeout: 15000 }); });
  await step("Act 2.5: Skip", async () => { await waitScene("scene-act25"); await click(/^Skip/); });
  await step("Ad: Skip ad (1st click denied)", async () => {
    await waitScene("scene-ad");
    await click(/Skip ad/);
    await sleep(300);
    if (!(await scene()).includes("scene-ad")) throw new Error("ad skipped on first click");
  });
  await step("Ad: Skip ad (2nd click works)", async () => { await click(/Skip ad/); await waitScene("scene-act2-card"); });
  await step("Act II card: Skip, Action", async () => { await card("scene-act2"); });
  await step(`Director: ${camera === "fake" ? "Allow camera" : "Allow camera with camera " + camera}`, async () => {
    await click(/Allow camera/);
    await page.waitForSelector(".slate-input", { timeout: camera === "hang" ? 15000 : 20000 });
    const notice = await page.evaluate(() => document.querySelector(".intro-notice, .dir-notice, .notice")?.textContent || document.body.innerText.match(/(Camera permission[^.]*\.|The camera didn't answer[^.]*\.|No camera found[^.]*\.)/)?.[0] || "");
    console.log("        notice:", notice);
  });
  await step("Director: direct a line, hint chip", async () => {
    await page.type(".slate-input", "make it noir with rain");
    await page.keyboard.press("Enter");
    await sleep(2500);
    await page.waitForSelector(".hint:not([disabled])", { timeout: 15000 });
    const chip = await page.$(".hint:not([disabled])");
    if (!chip) throw new Error("no hint chips");
    const bb = await chip.boundingBox();
    const hit = await page.evaluate((x, y) => { const e = document.elementFromPoint(x, y); return e && e.classList.contains("hint"); }, bb.x + bb.width / 2, bb.y + bb.height / 2);
    if (!hit) throw new Error("hint chip is covered by something");
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await sleep(2500);
  });
  for (let shot = 1; shot <= 4; shot++) {
    await step(`Director: take shot ${shot}`, async () => {
      await page.waitForSelector(".slate-input:not([disabled])", { timeout: 20000 });
      await page.click(".slate-input", { clickCount: 3 });
      await page.keyboard.type("freeze");
      await page.keyboard.press("Enter");
      await sleep(1800);
    });
  }
  await step("Act III: Skip to the verdict -> Roll credits", async () => {
    await waitScene("scene-act3", 15000);
    await click(/Skip to the verdict/, { timeout: 20000 }).catch(() => {});
    await click(/Roll credits/, { timeout: 60000 });
  });
  await step("Credits: Skip roll, strip, share", async () => {
    await waitScene("scene-credits");
    await click(/Skip roll/).catch(() => {});
    await click(/Share credits card/);
    await sleep(1500);
  });
  await step("Credits: Watch your trailer -> Roll -> Skip -> Back", async () => {
    await click(/Watch your trailer/);
    await waitScene("scene-trailer");
    await click(/Roll trailer/, { timeout: 25000 });
    await sleep(2500);
    await click(/^Skip$/);
    await click(/Back to credits/);
    await waitScene("scene-credits");
  });
  await step("Select scene menu: every entry", async () => {
    const n = await (async () => { await click(/Select scene/); return page.$$eval(".scene-menu button", (b) => b.length); })();
    console.log("        menu entries:", n);
    await click(/Opening titles/);
    await waitScene("scene-opening");
  });
} catch (e) {
  console.log("STOPPED:", e.message);
  await page.screenshot({ path: `smoke-fail-${camera}.png` });
}
console.log("speech utterances spoken:", await page.evaluate(() => window.__spoke).catch(() => "?"));
const cls = await page.evaluate(() => window.__cls).catch(() => 0);
const shifts = await page.evaluate(() => window.__shifts).catch(() => []);
if (shifts.length) console.log("biggest layout shifts:", "\n  " + shifts.join("\n  "));
console.log("layout shift (CLS) over the whole film:", cls.toFixed(3));
const li = [...new Set(layoutIssues)];
console.log("LAYOUT ISSUES:", li.length ? "\n  " + li.join("\n  ") : "none");
console.log("\nPROBLEMS:", problems.length ? problems.join("\n  ") : "none");
const uniq = [...new Set(errors)];
console.log("ERRORS:", uniq.length ? "\n  " + uniq.join("\n  ") : "none");
await browser.close();
