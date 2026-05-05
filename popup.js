"use strict";

const DEFAULT_TEMPLATE = "Hi {first name}, I wanted to connect.";
const TEMPLATE_KEY      = "messageTemplate";
const SHEET_URL_KEY     = "sheetUrl";
const CONTACTS_KEY      = "sheetContacts";
const HEADERS_KEY       = "sheetHeaders";
const ENABLED_KEY       = "extensionEnabled";
const ACTIVE_TAB_KEY    = "activeSetupTab";
const CONTENT_VERSION   = "2.2";

const $ = (id) => document.getElementById(id);

const dom = {
  popup:                $("popup"),
  liveBadge:            $("liveBadge"),
  liveBadgeText:        $("liveBadgeText"),
  toggle:               $("extensionToggle"),
  toggleText:           $("extensionToggleText"),
  dossier:              $("dossier"),
  dossierEyebrow:       $("dossierEyebrow"),
  dossierName:          $("dossierName"),
  dossierRole:          $("dossierRole"),
  preview:              $("templatePreview"),
  copyBtn:              $("copyNoteBtn"),
  addToSheetBtn:        $("addToSheetBtn"),
  copyStatus:           $("copyStatus"),
  tabSheet:             $("tab-sheet"),
  tabTemplate:          $("tab-template"),
  tabShortcuts:         $("tab-shortcuts"),
  panelSheet:           $("panel-sheet"),
  panelTemplate:        $("panel-template"),
  panelShortcuts:       $("panel-shortcuts"),
  sheetUrl:             $("sheetUrlInput"),
  syncSheet:            $("syncSheetBtn"),
  clearSheet:           $("clearSheetBtn"),
  sheetStatus:          $("sheetStatus"),
  contactCount:         $("contactCount"),
  templateTokenCount:   $("templateTokenCount"),
  template:             $("templateInput"),
  saveTemplate:         $("saveBtn"),
  resetTemplate:        $("resetBtn"),
  templateStatus:       $("status"),
  variableTokenRow:     $("variableTokenRow"),
  diagnose:             $("diagnoseBtn"),
  diagnoseStatus:       $("diagnoseStatus")
};

let state = {
  contacts: [],
  headers:  [],
  matched:  null,
  detectedName: ""
};

function setStatus(el, message, type) {
  el.textContent = message || "";
  el.className = `status${type === "ok" ? " ok" : type === "error" ? " error" : ""}`;
}

function updateExtensionToggle(isEnabled) {
  dom.toggleText.textContent = isEnabled ? "Live" : "Paused";
  dom.toggle.setAttribute("aria-pressed", String(isEnabled));
  dom.popup.classList.toggle("paused", !isEnabled);
}

function setLiveBadge(stateName, label) {
  dom.liveBadge.dataset.state = stateName;
  dom.liveBadgeText.textContent = label;
}

function parseCsvRows(csvText) {
  const rows = [];
  let row = []; let current = ""; let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      row.push(current); current = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(current);
      if (row.some((v) => v.trim())) rows.push(row.map((v) => v.trim()));
      row = []; current = "";
    } else { current += ch; }
  }
  row.push(current);
  if (row.some((v) => v.trim())) rows.push(row.map((v) => v.trim()));
  return rows;
}

function normalizeHeaderKey(value) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function makeUniqueHeaders(headerRow) {
  const counts = new Map();
  return headerRow.map((raw) => {
    const base = (raw || "").trim();
    if (!base) return "";
    const key = base.toLowerCase();
    const count = counts.get(key) || 0;
    counts.set(key, count + 1);
    return count ? `${base} ${count + 1}` : base;
  });
}

function findHeaderIndex(normalized, aliases) {
  return normalized.findIndex((h) => aliases.includes(h));
}

function parseContactsCsv(csvText) {
  const rows = parseCsvRows(csvText);
  if (!rows.length) return { contacts: [], headers: [] };
  const headerNames = makeUniqueHeaders(rows[0]);
  const headers = headerNames.map(normalizeHeaderKey);
  const firstIdx = findHeaderIndex(headers, ["firstname", "first"]);
  const lastIdx  = findHeaderIndex(headers, ["lastname", "last", "surname"]);
  const titleIdx = findHeaderIndex(headers, ["title", "jobtitle", "position", "role"]);
  const compIdx  = findHeaderIndex(headers, ["company", "companyname", "accountname", "organization", "organisation", "employer"]);
  if (firstIdx === -1 || lastIdx === -1) {
    throw new Error("Missing required headers. Need: first name and last name.");
  }
  const contacts = rows.slice(1).map((r) => {
    const fields = {};
    headerNames.forEach((h, i) => { if (h) fields[h] = (r[i] || "").trim(); });
    return {
      firstName: (r[firstIdx] || "").trim(),
      lastName:  (r[lastIdx]  || "").trim(),
      title:     titleIdx === -1 ? "" : (r[titleIdx] || "").trim(),
      company:   compIdx  === -1 ? "" : (r[compIdx]  || "").trim(),
      fields
    };
  }).filter((c) => c.firstName && c.lastName);
  return { contacts, headers: headerNames.filter(Boolean) };
}

function toCsvExportUrl(sheetUrl) {
  const url = new URL(sheetUrl);
  if (url.hostname !== "docs.google.com") {
    throw new Error("Use a docs.google.com spreadsheet URL.");
  }
  const m = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) throw new Error("Invalid Google Sheet URL.");
  const gid = url.searchParams.get("gid") || "0";
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
}

function getFieldValue(contact, tokenName) {
  if (!contact) return "";
  const fields = contact.fields && typeof contact.fields === "object" ? contact.fields : contact;
  const targetKey = normalizeHeaderKey(tokenName);
  const found = Object.keys(fields).find((k) => normalizeHeaderKey(k) === targetKey);
  return found ? String(fields[found] || "").trim() : "";
}

function renderTemplate(template, contact) {
  return (template || DEFAULT_TEMPLATE).replace(/\{([^{}]+)\}/g, (full, name) => {
    const v = getFieldValue(contact, name);
    return v || full;
  }).trim();
}

function renderTemplateAsHtml(template, contact) {
  const escape = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  return (template || DEFAULT_TEMPLATE).replace(/\{([^{}]+)\}/g, (full, name) => {
    const v = getFieldValue(contact, name);
    if (v) return `<span class="var">${escape(v)}</span>`;
    return `<span class="var" style="background:transparent;color:var(--ink-faint);border:1px dashed var(--rule-2)">${escape(full)}</span>`;
  });
}

async function loadEnabled() {
  const r = await chrome.storage.sync.get({ [ENABLED_KEY]: true });
  updateExtensionToggle(r[ENABLED_KEY] !== false);
}
async function toggleEnabled() {
  const r = await chrome.storage.sync.get({ [ENABLED_KEY]: true });
  const next = r[ENABLED_KEY] === false;
  await chrome.storage.sync.set({ [ENABLED_KEY]: next });
  updateExtensionToggle(next);
}

async function loadTemplate() {
  const r = await chrome.storage.sync.get({ [TEMPLATE_KEY]: DEFAULT_TEMPLATE });
  dom.template.value = r[TEMPLATE_KEY] || DEFAULT_TEMPLATE;
  refreshDossierPreview();
}
async function saveTemplate() {
  const next = (dom.template.value || "").trim() || DEFAULT_TEMPLATE;
  await chrome.storage.sync.set({ [TEMPLATE_KEY]: next });
  dom.template.value = next;
  refreshDossierPreview();
  setStatus(dom.templateStatus, "Template saved.", "ok");
}
async function resetTemplate() {
  dom.template.value = DEFAULT_TEMPLATE;
  await saveTemplate();
}

async function loadSheet() {
  const sync = await chrome.storage.sync.get({ [SHEET_URL_KEY]: "" });
  const local = await chrome.storage.local.get({
    [CONTACTS_KEY]: [],
    [HEADERS_KEY]:  []
  });
  dom.sheetUrl.value = sync[SHEET_URL_KEY] || "";
  state.contacts = Array.isArray(local[CONTACTS_KEY]) ? local[CONTACTS_KEY] : [];
  state.headers = Array.isArray(local[HEADERS_KEY])
    ? local[HEADERS_KEY].filter(Boolean)
    : inferHeadersFromContacts(state.contacts);
  dom.contactCount.textContent = String(state.contacts.length);
  renderTokenRow();
  setStatus(
    dom.sheetStatus,
    state.contacts.length
      ? `${state.contacts.length} contacts · ${state.headers.length} variables loaded.`
      : "No sheet data yet.",
    state.contacts.length ? "ok" : ""
  );
}

async function syncSheet() {
  const url = (dom.sheetUrl.value || "").trim();
  if (!url) { setStatus(dom.sheetStatus, "Paste a Google Sheet URL first.", "error"); return; }
  setStatus(dom.sheetStatus, "Syncing sheet…");
  setSheetLoading(true);
  try {
    const res = await fetch(toCsvExportUrl(url));
    if (!res.ok) throw new Error(`Fetch failed (${res.status}). Check sharing permissions.`);
    const { contacts, headers } = parseContactsCsv(await res.text());
    await chrome.storage.sync.set({ [SHEET_URL_KEY]: url });
    await chrome.storage.local.set({ [CONTACTS_KEY]: contacts, [HEADERS_KEY]: headers });
    state.contacts = contacts; state.headers = headers;
    dom.contactCount.textContent = String(contacts.length);
    renderTokenRow();
    refreshDossierPreview();
    setStatus(dom.sheetStatus, `Synced ${contacts.length} contacts · ${headers.length} variables.`, "ok");
  } catch (err) {
    setStatus(dom.sheetStatus, err.message || "Could not sync sheet.", "error");
  } finally {
    setSheetLoading(false);
  }
}

async function clearSheet() {
  await chrome.storage.local.set({ [CONTACTS_KEY]: [], [HEADERS_KEY]: [] });
  await chrome.storage.sync.set({ [SHEET_URL_KEY]: "" });
  dom.sheetUrl.value = "";
  state.contacts = []; state.headers = [];
  dom.contactCount.textContent = "0";
  renderTokenRow();
  refreshDossierPreview();
  setStatus(dom.sheetStatus, "Sheet data cleared.", "ok");
}

function setSheetLoading(loading) {
  dom.syncSheet.disabled  = loading;
  dom.clearSheet.disabled = loading;
  dom.sheetUrl.disabled   = loading;
  dom.syncSheet.textContent = loading ? "Syncing…" : "Sync sheet";
}

function inferHeadersFromContacts(contacts) {
  const c = contacts.find((x) => x && typeof x === "object");
  if (!c) return [];
  if (c.fields && typeof c.fields === "object") return Object.keys(c.fields);
  return [];
}

function renderTokenRow() {
  dom.variableTokenRow.replaceChildren();
  state.headers.forEach((h) => {
    const btn = document.createElement("button");
    const tk  = `{${h}}`;
    btn.type = "button"; btn.className = "token variable-btn";
    btn.dataset.token = tk; btn.textContent = tk;
    dom.variableTokenRow.appendChild(btn);
  });
  updateTemplateMeta();
}

function updateTemplateMeta() {
  const tpl = dom.template.value || "";
  const available = new Set(state.headers.map(normalizeHeaderKey));
  const used = new Set(
    Array.from(tpl.matchAll(/\{([^{}]+)\}/g))
      .map((m) => normalizeHeaderKey(m[1]))
      .filter((t) => !available.size || available.has(t))
  );
  dom.templateTokenCount.textContent = String(used.size);
  refreshDossierPreview();
}

function insertTokenAtCursor(tk) {
  const el = dom.template;
  const start = el.selectionStart ?? el.value.length;
  const end   = el.selectionEnd   ?? el.value.length;
  el.value = el.value.slice(0, start) + tk + el.value.slice(end);
  el.focus();
  el.setSelectionRange(start + tk.length, start + tk.length);
  updateTemplateMeta();
}

function refreshDossierPreview() {
  const tpl = dom.template ? (dom.template.value || DEFAULT_TEMPLATE) : DEFAULT_TEMPLATE;

  if (state.matched) {
    dom.dossier.classList.remove("standby");
    setLiveBadge("matched", "Matched");
    dom.dossierEyebrow.textContent = "From the open tab";
    dom.dossierName.innerHTML = formatNameHtml(state.matched.firstName, state.matched.lastName);
    dom.dossierRole.innerHTML = formatRole(state.matched);
    dom.preview.innerHTML = renderTemplateAsHtml(tpl, state.matched);
    dom.copyBtn.disabled = false;
    dom.copyBtn.querySelector("span").textContent = "Copy note";
    dom.addToSheetBtn.hidden = true;
    return;
  }

  if (state.detectedName) {
    dom.dossier.classList.remove("standby");
    setLiveBadge("nomatch", "No match");
    dom.dossierEyebrow.textContent = "Profile detected";
    dom.dossierName.textContent = state.detectedName;
    dom.dossierRole.textContent = "Not in your sheet — copy the raw template or add this contact.";
    dom.preview.innerHTML = renderTemplateAsHtml(tpl, null);
    dom.copyBtn.disabled = false;
    dom.copyBtn.querySelector("span").textContent = "Copy raw template";
    dom.addToSheetBtn.hidden = false;
    return;
  }

  dom.dossier.classList.add("standby");
  setLiveBadge("standby", "Standby");
  dom.dossierEyebrow.textContent = "Open a profile";
  dom.dossierName.textContent = "Open a LinkedIn profile to send a note.";
  dom.dossierRole.textContent = "";
  dom.preview.innerHTML = "";
  dom.copyBtn.disabled = true;
  dom.copyBtn.querySelector("span").textContent = "Copy note";
  dom.addToSheetBtn.hidden = true;
}

function formatNameHtml(first, last) {
  const f = (first || "").trim();
  const l = (last  || "").trim();
  if (!f && !l) return "";
  if (!l) return escapeHtml(f);
  return `${escapeHtml(f)} <em>${escapeHtml(l)}</em>`;
}

function formatRole(c) {
  const parts = [];
  if (c.title)   parts.push(escapeHtml(c.title));
  if (c.company) parts.push(escapeHtml(c.company));
  const city = getFieldValue(c, "city");
  if (city) parts.push(escapeHtml(city));
  return parts.join(`<span class="sep">·</span>`);
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

async function copyNote() {
  const tpl = dom.template.value || DEFAULT_TEMPLATE;
  const text = renderTemplate(tpl, state.matched || null);
  try {
    await navigator.clipboard.writeText(text);
    setStatus(dom.copyStatus, "Copied to clipboard.", "ok");
    setTimeout(() => setStatus(dom.copyStatus, ""), 2400);
  } catch (e) {
    setStatus(dom.copyStatus, "Could not copy. Click in the popup and retry.", "error");
  }
}

const PANELS = [
  { tab: "tabSheet",     panel: "panelSheet",     name: "sheet" },
  { tab: "tabTemplate",  panel: "panelTemplate",  name: "template" },
  { tab: "tabShortcuts", panel: "panelShortcuts", name: "shortcuts" }
];

async function loadActiveTab() {
  const r = await chrome.storage.sync.get({ [ACTIVE_TAB_KEY]: "sheet" });
  selectTab(r[ACTIVE_TAB_KEY]);
}
async function selectTab(name) {
  const target = PANELS.find((p) => p.name === name) || PANELS[0];
  PANELS.forEach((p) => {
    const isActive = p === target;
    dom[p.tab].setAttribute("aria-selected", String(isActive));
    dom[p.panel].hidden = !isActive;
  });
  await chrome.storage.sync.set({ [ACTIVE_TAB_KEY]: target.name });
}

async function getActiveLinkedInTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:\/\/([^/]+\.)?linkedin\.com\//i.test(tab.url || "")) {
    throw new Error("Open a LinkedIn profile tab first.");
  }
  return tab;
}

async function ensureContentScript(tabId) {
  const [{ result: loaded } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__ORTUS_F1_CONNECTION_VERSION__ || null
  });
  if (loaded === CONTENT_VERSION) return;
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
}

async function runDiagnosis() {
  dom.diagnose.disabled = true;
  setStatus(dom.diagnoseStatus, "Running diagnosis…");
  try {
    const tab = await getActiveLinkedInTab();
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, {
      source: `quickconnect:${CONTENT_VERSION}`,
      action: "diagnoseProfile"
    });
    if (!response?.ok) throw new Error(response?.error || "Diagnosis failed.");
    const report = JSON.stringify(response.report, null, 2);
    await navigator.clipboard.writeText(report);
    console.log("Ortus Club diagnosis", response.report);
    setStatus(dom.diagnoseStatus, "Diagnosis copied to clipboard.", "ok");
  } catch (e) {
    setStatus(dom.diagnoseStatus, e.message || "Could not run diagnosis.", "error");
  } finally {
    dom.diagnose.disabled = false;
  }
}

dom.toggle.addEventListener("click", toggleEnabled);
dom.saveTemplate.addEventListener("click", saveTemplate);
dom.resetTemplate.addEventListener("click", resetTemplate);
dom.template.addEventListener("input", updateTemplateMeta);
dom.syncSheet.addEventListener("click", syncSheet);
dom.clearSheet.addEventListener("click", clearSheet);
dom.diagnose.addEventListener("click", runDiagnosis);
dom.copyBtn.addEventListener("click", copyNote);
dom.variableTokenRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".variable-btn");
  const tk = btn?.dataset?.token;
  if (tk) insertTokenAtCursor(tk);
});
PANELS.forEach((p) => dom[p.tab].addEventListener("click", () => selectTab(p.name)));

async function detectActiveProfile() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\/([^/]+\.)?linkedin\.com\/in\//i.test(tab.url || "")) {
      state.matched = null;
      state.detectedName = "";
      return;
    }
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, {
      source: `quickconnect:${CONTENT_VERSION}`,
      action: "getActiveProfileName"
    });
    const name = (response?.name || "").trim();
    if (!name) {
      state.matched = null;
      state.detectedName = "";
      return;
    }
    const matched = (typeof matchContact === "function")
      ? matchContact(name, state.contacts)
      : null;
    state.matched = matched;
    state.detectedName = matched ? "" : name;
  } catch (err) {
    console.warn("Ortus Club: profile detection failed", err);
    state.matched = null;
    state.detectedName = "";
  }
}

(async function boot() {
  await loadEnabled();
  await loadTemplate();
  await loadSheet();
  await loadActiveTab();
  await detectActiveProfile();
  refreshDossierPreview();
})();
