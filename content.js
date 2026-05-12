// Function to find a button-like element by visible text or aria-label and click it.
const QUICKCONNECT_CONTENT_VERSION = "2.2";
const QUICKCONNECT_MESSAGE_SOURCE = `quickconnect:${QUICKCONNECT_CONTENT_VERSION}`;
const RECOMMENDED_CHROME_MAJOR = 147;
const MINIMUM_CHROME_MAJOR = 120;
window.__ORTUS_F1_CONNECTION_LOADED__ = true;
window.__ORTUS_F1_CONNECTION_VERSION__ = QUICKCONNECT_CONTENT_VERSION;

function clickLinkedInButton(possibleTexts) {
    // Prefer the open dialog first so modal actions (e.g. invite flow) are clicked reliably.
    const dialogs = querySelectorAllDeep(document, '[role="dialog"], .artdeco-modal');
    const menu = querySelectorDeep(document, '[role="menu"], .artdeco-dropdown__content--is-open');
    const profileMain = document.querySelector('main');
    const roots = dialogs.length ? dialogs : [menu, profileMain, document].filter(Boolean);
    const normalizedTargets = possibleTexts.map((t) => t.toLowerCase());

    for (const root of roots) {
        const candidates = querySelectorAllDeep(root, 'button, [role="button"], a[role="button"]')
            .filter((element) => isActionCandidate(element) && !isUnsafeRightPanelTarget(element));

        for (const element of candidates) {
            for (const target of normalizedTargets) {
                if (doesButtonMatch(element, [target])) {
                    if (!activateElement(element)) return false;
                    console.log("LinkedIn QuickConnect: clicked", target);
                    return true;
                }
            }
        }
    }

    console.log("LinkedIn QuickConnect: no matching button for", possibleTexts);
    return false;
}

function clickOpenDialogButton(possibleTexts, options = {}) {
    const dialogs = querySelectorAllDeep(document, '[role="dialog"], .artdeco-modal')
        .filter(isVisibleElement);

    for (const dialog of dialogs) {
        if (clickButtonInRoot(dialog, possibleTexts, options)) return true;
    }

    return false;
}

function clickButtonInRoot(root, possibleTexts, options = {}) {
    const element = findButtonInRoot(root, possibleTexts, options);
    if (!element) return false;

    return activateElement(element);
}

function findButtonInRoot(root, possibleTexts, options = {}) {
    if (!root) return null;

    const normalizedTargets = possibleTexts.map((text) => text.toLowerCase());
    const candidates = querySelectorAllDeep(root, 'button, [role="button"], a[role="button"]')
        .filter((element) => isActionCandidate(element) && !isUnsafeRightPanelTarget(element));

    for (const element of candidates) {
        if (!doesButtonMatch(element, normalizedTargets, options)) continue;
        if (options.requirePrimary && !isPrimaryActionButton(element)) continue;
        return element;
    }

    return null;
}

function findTextActionInRoot(root, possibleTexts, options = {}) {
    if (!root) return null;

    const normalizedTargets = possibleTexts.map((text) => text.toLowerCase());
    const candidates = querySelectorAllDeep(root, "button, [role='button'], a[role='button'], button *, [role='button'] *, a[role='button'] *")
        .filter(isVisibleElement)
        .filter((element) => {
            const values = getElementTextValues(element);
            return normalizedTargets.some((target) => values.some((value) => (
                options.exact ? isExactishButtonText(value, target) : value === target || value.includes(target)
            )));
        })
        .map((element) => element.closest('button, [role="button"], a[role="button"]') || element)
        .filter((element, index, elements) => elements.indexOf(element) === index)
        .filter((element) => isActionCandidate(element) && !isUnsafeRightPanelTarget(element))
        .filter((element) => !options.requirePrimary || isPrimaryActionButton(element));

    return candidates[0] || null;
}

function doesButtonMatch(element, normalizedTargets, options = {}) {
    const values = getElementTextValues(element);

    if (options.intent === "connect" && values.some(isConnectIntentText)) return true;
    if (options.intent === "more" && values.some(isMoreActionsIntentText)) return true;

    return normalizedTargets.some((target) => values.some((value) => (
        options.exact ? isExactishButtonText(value, target) : value === target || value.includes(target)
    )));
}

function isConnectIntentText(value) {
    return (
        value === "connect" ||
        /\bconnect\b/.test(value) ||
        (value.includes("invite") && value.includes("connect"))
    );
}

function isMoreActionsIntentText(value) {
    return (
        value === "more" ||
        value === "more actions" ||
        value === "more options" ||
        value.startsWith("more actions ") ||
        value.startsWith("more options ") ||
        value.startsWith("see more actions") ||
        value.startsWith("show more actions") ||
        value.startsWith("open more actions")
    );
}

function isExactishButtonText(value, target) {
    return (
        value === target ||
        value.startsWith(`${target} `) ||
        value.endsWith(` ${target}`)
    );
}

function getElementTextValues(element) {
    const root = element.getRootNode?.() || document;
    const labelledBy = (element.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .map((id) => root.getElementById?.(id)?.textContent || document.getElementById(id)?.textContent || "")
        .join(" ");

    return [
        element.innerText,
        element.textContent,
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        labelledBy
    ]
        .map((value) => normalizeButtonText(value))
        .filter(Boolean);
}

function querySelectorDeep(root, selector) {
    return querySelectorAllDeep(root, selector)[0] || null;
}

function querySelectorAllDeep(root, selector) {
    if (!root?.querySelectorAll) return [];

    const results = [];
    const seen = new Set();
    const visitRoot = (currentRoot) => {
        if (!currentRoot?.querySelectorAll) return;

        currentRoot.querySelectorAll(selector).forEach((element) => {
            if (seen.has(element)) return;
            seen.add(element);
            results.push(element);
        });

        currentRoot.querySelectorAll("*").forEach((element) => {
            if (element.shadowRoot) visitRoot(element.shadowRoot);
        });
    };

    visitRoot(root);
    return results;
}

function normalizeButtonText(value) {
    return (value || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function getProfileTopCardRoot() {
    const main = document.querySelector("main");
    const heading = main?.querySelector("h1") || document.querySelector("main .text-heading-xlarge");
    if (heading) {
        const root = findProfileHeaderRoot(heading, main);
        if (root) return root;
    }

    const topCardSelectors = [
        "main .pv-top-card",
        "main .pv-top-card-v2-ctas__custom",
        "main section.artdeco-card"
    ];

    for (const selector of topCardSelectors) {
        const root = document.querySelector(selector);
        if (root) return root;
    }

    return null;
}

function getProfileHeading() {
    const main = document.querySelector("main");
    return main?.querySelector("h1, .text-heading-xlarge") || null;
}

function getProfileActionRoots() {
    const main = document.querySelector("main");
    const heading = getProfileHeading();
    const roots = [];

    const addRoot = (root) => {
        if (root && root.querySelectorAll && !roots.includes(root)) roots.push(root);
    };

    const topCardRoot = getProfileTopCardRoot();
    const headingRoot = heading?.closest?.([
        ".pv-top-card",
        ".pv-profile-card",
        ".ph5.pb5",
        "section.artdeco-card",
        "section",
        "article"
    ].join(","));

    addRoot(topCardRoot);
    addRoot(headingRoot);

    const semanticActionSelectors = [
        ".pv-top-card-v2-ctas",
        ".pv-top-card-v2-ctas__custom",
        ".pvs-profile-actions",
        ".pv-s-profile-actions",
        ".pv-top-card"
    ].join(",");

    querySelectorAllDeep(main || document, semanticActionSelectors).forEach((root) => {
        if (!headingRoot || headingRoot.contains(root) || root.contains(heading)) addRoot(root);
    });

    addRoot(main);
    return roots;
}

function findProfileActionButton(possibleTexts, options = {}) {
    const roots = getProfileActionRoots();
    const main = document.querySelector("main");
    const heading = getProfileHeading();
    const headingRoot = heading?.closest?.([
        ".pv-top-card",
        ".pv-profile-card",
        ".ph5.pb5",
        "section.artdeco-card",
        "section",
        "article"
    ].join(","));
    const headingRect = heading?.getBoundingClientRect();
    const normalizedTargets = possibleTexts.map((text) => text.toLowerCase());
    const candidates = [];
    const seen = new Set();

    roots.forEach((root, rootIndex) => {
        querySelectorAllDeep(root, "button, [role='button'], a[role='button'], button *, [role='button'] *, a[role='button'] *")
            .map((element) => element.closest('button, [role="button"], a[role="button"]') || element)
            .forEach((element) => {
                if (seen.has(element)) return;
                seen.add(element);
                if (!isActionCandidate(element) || !doesButtonMatch(element, normalizedTargets, options)) return;
                if (!isProfileOwnedAction(element, { main, headingRoot, headingRect })) return;
                candidates.push({
                    element,
                    score: scoreProfileActionCandidate(element, {
                        root,
                        rootIndex,
                        main,
                        headingRoot,
                        headingRect,
                        preferPrimary: options.preferPrimary
                    })
                });
            });
    });

    candidates.sort((a, b) => a.score - b.score);
    return candidates[0]?.element || null;
}

function findProfileHeaderRoot(heading, main) {
    const headingRect = heading.getBoundingClientRect();
    const candidates = [];
    let node = heading;

    while (node && node !== document.body) {
        if (node.nodeType === Node.ELEMENT_NODE && (node === main || node.matches("section, article, div"))) {
            const rect = node.getBoundingClientRect();
            const hasNearbyAction = Array.from(
                node.querySelectorAll('button, [role="button"], a[role="button"]')
            ).some((button) => isProfileHeaderAction(button, headingRect));

            if (hasNearbyAction && rect.height > 0 && rect.height <= 760) {
                candidates.push({ node, area: rect.width * rect.height });
            }
        }

        if (node === main) break;
        node = node.parentElement;
    }

    candidates.sort((a, b) => a.area - b.area);
    return candidates[0]?.node || null;
}

function findProfileHeaderButton(possibleTexts, options = {}) {
    const root = getProfileTopCardRoot() || document.querySelector("main");
    const heading = root?.querySelector("h1") || document.querySelector("main h1, main .text-heading-xlarge");
    const headingRect = heading?.getBoundingClientRect();
    if (!root || !headingRect) return null;

    const normalizedTargets = possibleTexts.map((text) => text.toLowerCase());
    const candidates = Array.from(
        root.querySelectorAll('button, [role="button"], a[role="button"]')
    )
        .filter((element) => isProfileHeaderAction(element, headingRect))
        .filter((element) => doesButtonMatch(element, normalizedTargets, options))
        .map((element) => ({
            element,
            distance: getProfileHeaderDistance(element, headingRect)
        }))
        .sort((a, b) => a.distance - b.distance);

    return candidates[0]?.element || null;
}

function findOrbitaProfileHeaderButton(possibleTexts, options = {}) {
    const main = document.querySelector("main");
    const heading = main?.querySelector("h1, .text-heading-xlarge");
    const headingRect = heading?.getBoundingClientRect();
    if (!main || !headingRect) return null;

    const normalizedTargets = possibleTexts.map((text) => text.toLowerCase());
    const candidates = Array.from(
        main.querySelectorAll('button, [role="button"], a[role="button"]')
    )
        .filter(isActionCandidate)
        .filter((element) => !isUnsafeRightPanelTarget(element))
        .filter((element) => isBelowProfileHeading(element, headingRect))
        .filter((element) => doesButtonMatch(element, normalizedTargets, options))
        .map((element) => ({
            element,
            distance: getProfileHeaderDistance(element, headingRect)
        }))
        .sort((a, b) => a.distance - b.distance);

    return candidates[0]?.element || null;
}

function findOrbitaVisibleProfileButton(possibleTexts, options = {}) {
    const main = document.querySelector("main");
    if (!main) return null;

    const normalizedTargets = possibleTexts.map((text) => text.toLowerCase());
    const candidates = Array.from(
        main.querySelectorAll('button, [role="button"], a[role="button"]')
    )
        .filter(isActionCandidate)
        .filter((element) => !isUnsafeRightPanelTarget(element))
        .filter((element) => doesButtonMatch(element, normalizedTargets, options))
        .filter(isVisibleMainColumnProfileAction)
        .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
                element,
                score: Math.abs(rect.top - (window.innerHeight * 0.52)) + Math.max(0, rect.left - 220)
            };
        })
        .sort((a, b) => a.score - b.score);

    return candidates[0]?.element || null;
}

function findOrbitaVisibleTextAction(possibleTexts, options = {}) {
    const main = document.querySelector("main");
    if (!main) return null;

    const normalizedTargets = possibleTexts.map((text) => text.toLowerCase());
    const candidates = Array.from(main.querySelectorAll("button *, [role='button'] *, a[role='button'] *, span"))
        .filter(isVisibleElement)
        .filter(isVisibleMainColumnProfileAction)
        .filter((element) => {
            const values = getElementTextValues(element);
            return normalizedTargets.some((target) => values.some((value) => (
                options.exact ? value === target : value === target || value.includes(target)
            )));
        })
        .map((element) => {
            const action = element.closest('button, [role="button"], a[role="button"]') || element;
            const target = isActionCandidate(action) ? action : element;
            const rect = target.getBoundingClientRect();
            return {
                element: target,
                score: Math.abs(rect.top - (window.innerHeight * 0.52)) + Math.max(0, rect.left - 220)
            };
        })
        .filter(({ element }) => isVisibleElement(element) && !isUnsafeRightPanelTarget(element))
        .sort((a, b) => a.score - b.score);

    return candidates[0]?.element || null;
}

function findOpenProfileMenuAction(anchorElement, possibleTexts, options = {}) {
    const normalizedTargets = possibleTexts.map((text) => text.toLowerCase());
    const candidates = querySelectorAllDeep(document, 'button, [role="button"], a[role="button"], a, [role="menuitem"]')
        .filter(isVisibleElement)
        .filter((element) => !isUnsafeRightPanelTarget(element))
        .filter((element) => isNearAnchorMenu(element, anchorElement))
        .filter((element) => doesButtonMatch(element, normalizedTargets, options))
        .map((element) => ({
            element,
            distance: getMenuDistance(element, anchorElement)
        }))
        .sort((a, b) => a.distance - b.distance);

    return candidates[0]?.element || null;
}

function clickOpenProfileMenuAction(anchorElement, possibleTexts, options = {}) {
    const menuRoot = getOpenActionMenuRoot(anchorElement);
    if (clickButtonInRoot(menuRoot, possibleTexts, options)) return true;

    const element = findOpenProfileMenuAction(anchorElement, possibleTexts, options);
    return element ? activateElement(element) : false;
}

function isNearAnchorMenu(element, anchorElement) {
    if (!anchorElement) return false;

    const rect = element.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();
    return (
        rect.top >= anchorRect.top - 40 &&
        rect.top <= anchorRect.bottom + 520 &&
        rect.left >= Math.max(0, anchorRect.left - 520) &&
        rect.left <= anchorRect.right + 180
    );
}

function getMenuDistance(element, anchorElement) {
    const rect = element.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();
    return Math.abs(rect.top - anchorRect.bottom) + Math.abs(rect.left - anchorRect.left);
}

function isBelowProfileHeading(element, headingRect) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= headingRect.bottom - 40 &&
        rect.top <= headingRect.bottom + 520 &&
        rect.left >= Math.max(0, headingRect.left - 80) &&
        rect.left < Math.max(window.innerWidth * 0.72, headingRect.left + 820)
    );
}

function isVisibleMainColumnProfileAction(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.top <= Math.max(window.innerHeight, 900) &&
        rect.left >= 0 &&
        rect.left < Math.max(window.innerWidth * 0.58, 760)
    );
}

function isProfileHeaderAction(element, headingRect) {
    if (!isActionCandidate(element) || isUnsafeRightPanelTarget(element)) return false;

    const rect = element.getBoundingClientRect();
    const isNearProfileHeading = (
        rect.top >= headingRect.top - 80 &&
        rect.top <= headingRect.bottom + 520 &&
        rect.left < Math.max(window.innerWidth * 0.72, headingRect.left + 780)
    );
    const hasActionText = doesButtonMatch(element, ["connect", "more", "more actions", "message", "follow"], {
        exact: false
    });

    return isNearProfileHeading && hasActionText;
}

function getProfileHeaderDistance(element, headingRect) {
    const rect = element.getBoundingClientRect();
    return Math.abs(rect.top - headingRect.bottom) + Math.max(0, rect.left - headingRect.left);
}

function getOpenActionMenuRoot(anchorElement = null) {
    const menus = querySelectorAllDeep(document, '[role="menu"], .artdeco-dropdown__content--is-open')
        .filter(isVisibleElement);

    if (!anchorElement) return menus[0] || null;

    const anchorRect = anchorElement.getBoundingClientRect();
    const anchorCenterX = anchorRect.left + (anchorRect.width / 2);
    const anchorCenterY = anchorRect.top + (anchorRect.height / 2);

    return menus
        .map((menu) => {
            const rect = menu.getBoundingClientRect();
            const menuCenterX = rect.left + (rect.width / 2);
            const menuCenterY = rect.top + (rect.height / 2);
            return {
                menu,
                distance: Math.abs(menuCenterX - anchorCenterX) + Math.abs(menuCenterY - anchorCenterY)
            };
        })
        .filter((entry) => entry.distance <= 700)
        .sort((a, b) => a.distance - b.distance)[0]?.menu || null;
}

function activateElement(element) {
    if (isUnsafeRightPanelTarget(element)) {
        console.log("LinkedIn QuickConnect: blocked right-panel target", element);
        return false;
    }

    element.scrollIntoView?.({ block: "center", inline: "center" });
    element.focus?.();
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    element.click();
    return true;
}

function isActionCandidate(element) {
    if (!element || element.disabled || element.getAttribute("aria-disabled") === "true") return false;
    return isVisibleElement(element);
}

function isVisibleElement(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return false;
    return true;
}

function isSidebarElement(element) {
    return Boolean(element.closest('aside, [role="complementary"], .scaffold-layout__aside, .ad-banner-container'));
}

function isUnsafeRightPanelTarget(element) {
    if (!element) return true;
    if (isSidebarElement(element)) return true;

    // DOM-structure check only — no viewport math, no zoom/width
    // assumptions. The previous `rect.left >= innerWidth * 0.58`
    // heuristic rejected legitimate Connect buttons on wide monitors,
    // narrow windows, and after page reflow. Use known LinkedIn right-
    // rail container selectors instead. `.pv-profile-sticky-header` is
    // intentionally NOT in this list: when the operator has scrolled
    // past the top card the sticky header IS the primary Connect.
    if (element.closest([
        ".scaffold-layout__aside",
        ".scaffold-layout__sidebar",
        ".ad-banner-container",
        '[aria-label*="People also viewed"]',
        '[aria-label*="People you may know"]',
        '[aria-label*="Similar profiles"]',
        '[aria-label*="More profiles for you"]',
        '[aria-label*="Other profiles viewed"]'
    ].join(","))) {
        return true;
    }

    // Safety net: walk up to the nearest card/section. If the card
    // advertises itself as a suggestion/recommendation list, reject
    // any button inside it. Runs unconditionally so we catch right-
    // rail cards that don't wear one of the structural classes above.
    const card = element.closest("section, article, aside, [role='complementary']");
    if (card) {
        const cardText = normalizeButtonText(card.innerText || card.textContent);
        const rightPanelLabels = [
            "people also viewed",
            "people you may know",
            "similar profiles",
            "more profiles for you",
            "other profiles viewed"
        ];
        if (rightPanelLabels.some((label) => cardText.includes(label))) return true;
    }

    return false;
}

function isProfileOwnedAction(element, context = {}) {
    const { main, headingRoot, headingRect } = context;
    if (!main || !main.contains(element)) return false;
    if (isUnsafeRightPanelTarget(element)) return false;

    if (headingRoot?.contains(element)) return true;
    if (isProfileActionContainer(element) && !isNonProfileActionListItem(element)) return true;

    return Boolean(headingRect && isProfileHeaderAction(element, headingRect));
}

function isProfileActionContainer(element) {
    return Boolean(element.closest([
        ".pv-top-card",
        ".pv-top-card-v2-ctas",
        ".pv-top-card-v2-ctas__custom",
        ".pvs-profile-actions",
        ".pv-s-profile-actions"
    ].join(",")));
}

function isNonProfileActionListItem(element) {
    return Boolean(element.closest([
        ".entity-result",
        ".reusable-search__result-container",
        ".mn-connection-card",
        ".discover-person-card",
        ".artdeco-carousel__item"
    ].join(",")));
}

function scoreProfileActionCandidate(element, options = {}) {
    const { root, rootIndex = 0, main, headingRoot, headingRect, preferPrimary } = options;
    const rect = element.getBoundingClientRect();
    let score = rootIndex * 200;

    if (root && root !== main) score -= 250;
    if (headingRoot?.contains(element)) score -= 700;
    if (isProfileActionContainer(element)) score -= 400;
    if (preferPrimary && isPrimaryActionButton(element)) score -= 1000;

    const values = getElementTextValues(element);
    if (values.some((value) => value === "connect" || value === "more" || value === "more actions")) {
        score -= 120;
    }

    score += headingRect
        ? Math.min(getProfileHeaderDistance(element, headingRect) / 8, 240)
        : Math.min(rect.top / 8 + rect.left / 20, 240);

    return score;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_CONNECTION_TEMPLATE = "Hi {first name}, I wanted to connect.";
const TEMPLATE_STORAGE_KEY = "messageTemplate";
const CONTACTS_STORAGE_KEY = "sheetContacts";
const EXTENSION_ENABLED_STORAGE_KEY = "extensionEnabled";
const BROWSER_MODE_STORAGE_KEY = "browserMode";
const BROWSER_MODE_VM = "vm";
const ACTION_DEBOUNCE_MS = 450;
const recentActionTimes = new Map();

function extractFirstName() {
    const nameParts = extractProfileNameParts();
    return nameParts.firstName || "";
}

function extractFirstNameFromText(value) {
    const cleaned = cleanProfileNameText(value);
    const firstName = cleaned.split(" ")[0];
    return firstName || "";
}

function cleanProfileNameText(value) {
    return (value || "")
        .replace(/\(.*?\)/g, " ")
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, " ")
        .replace(/[^\p{L}\s'-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getProfileNameSources() {
    const topCard = getProfileTopCardRoot();

    return [
        topCard?.querySelector('h1'),
        topCard?.querySelector('.text-heading-xlarge'),
        topCard?.querySelector('.pv-text-details__left-panel h1'),
        document.querySelector('main h1'),
        document.querySelector('main .text-heading-xlarge'),
        document.querySelector('main .pv-text-details__left-panel h1'),
        document.querySelector('main [data-anonymize="person-name"]')
    ].filter(Boolean);
}

function extractNameFromDocumentTitle() {
    const titleName = (document.title || "")
        .replace(/^\(\d+\)\s*/, "")
        .replace(/\s*\|\s*LinkedIn.*$/i, "")
        .trim();

    return cleanProfileNameText(titleName);
}

function extractProfileFullName() {
    for (const source of getProfileNameSources()) {
        const raw = cleanProfileNameText(source?.textContent);
        if (raw) return raw;
    }

    return extractNameFromDocumentTitle();
}

function cleanProfileText(value) {
    return (value || "")
        .replace(/\(.*?\)/g, " ")
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, " ")
        .replace(/[^\p{L}\p{N}\s&.,/'-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getTopCardSubline() {
    const selectors = [
        'main .text-body-medium.break-words',
        '.pv-text-details__left-panel .text-body-medium',
        'main .pv-text-details__left-panel div.text-body-medium',
        'main .text-body-medium'
    ];

    for (const selector of selectors) {
        const value = cleanProfileText(document.querySelector(selector)?.textContent);
        if (value) return value;
    }
    return "";
}

function splitTitleAndCompany(text) {
    if (!text) return { title: "", company: "" };

    // Common LinkedIn format: "Title at Company"
    const atMatch = text.match(/^(.+?)\s+at\s+(.+)$/i);
    if (atMatch) {
        return {
            title: atMatch[1].trim(),
            company: atMatch[2].trim()
        };
    }

    // Fallback formats: "Title @ Company" or "Title, Company"
    const separators = [" @ ", " | ", " - ", ", "];
    for (const separator of separators) {
        const index = text.indexOf(separator);
        if (index > 0) {
            return {
                title: text.slice(0, index).trim(),
                company: text.slice(index + separator.length).trim()
            };
        }
    }

    return { title: text.trim(), company: "" };
}

function extractTitleAndCompany() {
    const subline = getTopCardSubline();
    let { title, company } = splitTitleAndCompany(subline);

    // Fallback: try current company link text when company is still missing.
    if (!company) {
        const companyCandidates = [
            '[data-field="experience_company_logo"]',
            'a[href*="/company/"] span[aria-hidden="true"]',
            'a[href*="/company/"]'
        ];

        for (const selector of companyCandidates) {
            const candidate = cleanProfileText(document.querySelector(selector)?.textContent);
            if (candidate) {
                company = candidate;
                break;
            }
        }
    }

    return { title, company };
}

function normalizeForMatch(value) {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function normalizeHeader(value) {
    return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getContactFieldValue(contact, tokenName) {
    if (!contact) return "";
    const fields = contact.fields && typeof contact.fields === "object" ? contact.fields : contact;
    const normalizedToken = normalizeHeader(tokenName);
    const key = Object.keys(fields).find((fieldName) => normalizeHeader(fieldName) === normalizedToken);
    return key ? String(fields[key] || "").trim() : "";
}

function getContactValue(contact, aliases, fallbackKey) {
    if (!contact) return "";
    if (fallbackKey && contact[fallbackKey]) return String(contact[fallbackKey]).trim();

    for (const alias of aliases) {
        const value = getContactFieldValue(contact, alias);
        if (value) return value;
    }

    return "";
}

function getContactFirstName(contact) {
    return getContactValue(contact, ["first name", "firstname", "first"], "firstName");
}

function getContactLastName(contact) {
    return getContactValue(contact, ["last name", "lastname", "last", "surname"], "lastName");
}

function getContactTitle(contact) {
    return getContactValue(contact, ["title", "job title", "position", "role"], "title");
}

function getContactCompany(contact) {
    return getContactValue(contact, ["company", "company name", "account name", "organization", "organisation", "employer"], "company");
}

function extractProfileNameParts() {
    const fullName = extractProfileFullName();
    const parts = fullName.split(/\s+/).filter(Boolean);
    return {
        fullName,
        firstName: parts[0] || "",
        lastName: parts.length > 1 ? parts[parts.length - 1] : ""
    };
}

async function getSheetContacts() {
    if (!chrome?.storage?.local) return [];

    try {
        const result = await chrome.storage.local.get({ [CONTACTS_STORAGE_KEY]: [] });
        return Array.isArray(result[CONTACTS_STORAGE_KEY]) ? result[CONTACTS_STORAGE_KEY] : [];
    } catch (error) {
        console.log("LinkedIn QuickConnect: contacts read failed", error);
        return [];
    }
}

function matchContactFromSheet(contacts, pageName, pageCompany) {
    const targetFirst = normalizeForMatch(pageName.firstName);
    const targetLast = normalizeForMatch(pageName.lastName);
    const targetCompany = normalizeForMatch(pageCompany);
    if (!targetFirst) return null;

    const nameMatches = contacts.filter((contact) => (
        normalizeForMatch(getContactFirstName(contact)) === targetFirst &&
        doesLastNameMatch(getContactLastName(contact), targetLast)
    ));

    if (nameMatches.length === 0) return null;
    if (nameMatches.length === 1) return nameMatches[0];

    if (targetCompany) {
        const companyMatches = nameMatches.filter((contact) => {
            const contactCompany = normalizeForMatch(getContactCompany(contact));
            return contactCompany && (
                contactCompany === targetCompany ||
                contactCompany.includes(targetCompany) ||
                targetCompany.includes(contactCompany)
            );
        });
        if (companyMatches.length === 1) return companyMatches[0];
    }

    console.log("LinkedIn QuickConnect: ambiguous duplicate for", pageName.fullName);
    return null;
}

function doesLastNameMatch(contactLastName, pageLastName) {
    const contactLast = normalizeForMatch(contactLastName);
    const pageLast = normalizeForMatch(pageLastName);
    if (!contactLast || !pageLast) return !pageLast;
    if (contactLast === pageLast) return true;
    return pageLast.length === 1 && contactLast.startsWith(pageLast);
}

async function personalizeTemplate(template) {
    const pageName = extractProfileNameParts();
    const pageData = extractTitleAndCompany();
    const contacts = await getSheetContacts();
    const matched = matchContactFromSheet(contacts, pageName, pageData.company);
    const firstName = getContactFirstName(matched) || pageName.firstName || extractFirstNameFromText(pageName.fullName);
    const lastName = getContactLastName(matched) || pageName.lastName;
    const title = getContactTitle(matched) || pageData.title;
    const company = getContactCompany(matched) || pageData.company;
    const fallbackValues = {
        firstname: firstName,
        lastname: lastName,
        fullname: pageName.fullName,
        name: pageName.fullName,
        title,
        jobtitle: title,
        position: title,
        role: title,
        company,
        companyname: company
    };

    return template.replace(/\{([^{}]+)\}/g, (match, tokenName) => {
        const sheetValue = getContactFieldValue(matched, tokenName);
        if (sheetValue) return sheetValue;

        const fallbackValue = fallbackValues[normalizeHeader(tokenName)];
        return fallbackValue || match;
    });
}

async function getQuickConnectDiagnostics() {
    const pageName = extractProfileNameParts();
    const pageData = extractTitleAndCompany();
    const contacts = await getSheetContacts();
    const matched = matchContactFromSheet(contacts, pageName, pageData.company);
    const connectButton = findProfileActionButton(['Connect'], { exact: true, intent: "connect", preferPrimary: true });
    const moreButton = findProfileActionButton(['More actions', 'More', 'More options', 'See more actions'], { exact: true, intent: "more" });
    const active = document.activeElement;
    const fallbackMenu = connectButton ? null : await getFallbackMenuDiagnostics(moreButton);

    return {
        version: QUICKCONNECT_CONTENT_VERSION,
        url: location.href,
        title: document.title,
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            dpr: window.devicePixelRatio
        },
        browser: getBrowserDiagnostics(),
        extensionEnabled: await isExtensionEnabled(),
        browserMode: await getBrowserMode(),
        actionMode: "universal",
        activeElement: summarizeElement(active),
        profile: {
            fullName: pageName.fullName,
            firstName: pageName.firstName,
            lastName: pageName.lastName,
            title: pageData.title,
            company: pageData.company,
            nameSources: getProfileNameSources().map((element) => cleanProfileNameText(element.textContent)).filter(Boolean)
        },
        sheet: {
            contactCount: contacts.length,
            matchedContact: matched ? {
                firstName: getContactFirstName(matched),
                lastName: getContactLastName(matched),
                title: getContactTitle(matched),
                company: getContactCompany(matched),
                fields: matched.fields || null
            } : null
        },
        templateSample: await personalizeTemplate(DEFAULT_CONNECTION_TEMPLATE),
        selectedActions: {
            connect: summarizeElement(connectButton),
            more: summarizeElement(moreButton)
        },
        fallbackMenu,
        candidates: {
            connect: getProfileActionDiagnostics(['Connect'], { exact: true, intent: "connect", preferPrimary: true }),
            more: getProfileActionDiagnostics(['More actions', 'More', 'More options', 'See more actions'], { exact: true, intent: "more" })
        }
    };
}

function getBrowserDiagnostics() {
    const userAgent = navigator.userAgent || "";
    const version = getChromeVersionFromUserAgent(userAgent);
    const major = version ? Number(version.split(".")[0]) : null;
    const status = getChromeSupportStatus(major);

    return {
        name: getChromeBrowserName(userAgent),
        version,
        major,
        status,
        recommendedMajor: RECOMMENDED_CHROME_MAJOR,
        minimumMajor: MINIMUM_CHROME_MAJOR,
        userAgent
    };
}

function getChromeVersionFromUserAgent(userAgent) {
    const match = String(userAgent || "").match(/\b(?:Chrome|CriOS)\/([0-9.]+)/);
    return match?.[1] || "";
}

function getChromeBrowserName(userAgent) {
    if (/Edg\//.test(userAgent)) return "Microsoft Edge";
    if (/OPR\//.test(userAgent)) return "Opera";
    if (/Brave\//.test(userAgent)) return "Brave";
    if (/Chrome\//.test(userAgent) || /CriOS\//.test(userAgent)) return "Chrome";
    return "Unknown Chromium browser";
}

function getChromeSupportStatus(major) {
    if (!major) return "unknown";
    if (major >= RECOMMENDED_CHROME_MAJOR) return "recommended";
    if (major >= MINIMUM_CHROME_MAJOR) return "update-recommended";
    return "unsupported";
}

async function getFallbackMenuDiagnostics(moreButton) {
    if (!moreButton) {
        return {
            opened: false,
            connect: null,
            candidates: [],
            reason: "More action was not found."
        };
    }

    const opened = activateElement(moreButton);
    await sleep(180);

    const menuRoot = getOpenActionMenuRoot(moreButton);
    const connect = findOpenProfileMenuAction(moreButton, ['Connect'], { exact: true, intent: "connect" });
    const candidates = getOpenMenuActionDiagnostics(moreButton, ['Connect'], { exact: true, intent: "connect" });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));

    return {
        opened,
        menuRoot: summarizeElement(menuRoot),
        connect: summarizeElement(connect),
        candidates,
        reason: connect ? "" : "Connect was not found in the opened More menu."
    };
}

function getOpenMenuActionDiagnostics(anchorElement, possibleTexts, options = {}) {
    const normalizedTargets = possibleTexts.map((text) => text.toLowerCase());

    return querySelectorAllDeep(document, 'button, [role="button"], a[role="button"], a, [role="menuitem"]')
        .filter((element) => doesButtonMatch(element, normalizedTargets, options))
        .map((element) => ({
            ...summarizeElement(element),
            nearAnchor: isNearAnchorMenu(element, anchorElement),
            actionable: isActionCandidate(element),
            distance: anchorElement ? Math.round(getMenuDistance(element, anchorElement)) : null
        }))
        .sort((a, b) => (a.distance || 0) - (b.distance || 0))
        .slice(0, 12);
}

function getProfileActionDiagnostics(possibleTexts, options = {}) {
    const roots = getProfileActionRoots();
    const main = document.querySelector("main");
    const heading = getProfileHeading();
    const headingRoot = heading?.closest?.([
        ".pv-top-card",
        ".pv-profile-card",
        ".ph5.pb5",
        "section.artdeco-card",
        "section",
        "article"
    ].join(","));
    const headingRect = heading?.getBoundingClientRect();
    const normalizedTargets = possibleTexts.map((text) => text.toLowerCase());
    const seen = new Set();
    const candidates = [];

    roots.forEach((root, rootIndex) => {
        querySelectorAllDeep(root, "button, [role='button'], a[role='button'], button *, [role='button'] *, a[role='button'] *")
            .map((element) => element.closest('button, [role="button"], a[role="button"]') || element)
            .forEach((element) => {
                if (seen.has(element)) return;
                seen.add(element);
                if (!doesButtonMatch(element, normalizedTargets, options)) return;

                const owned = isProfileOwnedAction(element, { main, headingRoot, headingRect });
                const score = scoreProfileActionCandidate(element, {
                    root,
                    rootIndex,
                    main,
                    headingRoot,
                    headingRect,
                    preferPrimary: options.preferPrimary
                });

                candidates.push({
                    ...summarizeElement(element),
                    actionable: isActionCandidate(element),
                    owned,
                    score: Math.round(score)
                });
            });
    });

    return candidates
        .sort((a, b) => a.score - b.score)
        .slice(0, 12);
}

function summarizeElement(element) {
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
        tag: element.tagName,
        role: element.getAttribute("role") || "",
        text: cleanProfileText(element.innerText || element.textContent).slice(0, 160),
        ariaLabel: cleanProfileText(element.getAttribute("aria-label")).slice(0, 160),
        title: cleanProfileText(element.getAttribute("title")).slice(0, 160),
        className: String(element.className || "").slice(0, 220),
        disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true"),
        visible: isVisibleElement(element),
        primary: isPrimaryActionButton(element),
        unsafeRightPanel: isUnsafeRightPanelTarget(element),
        rect: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        }
    };
}

function getMessageInputTarget(options = {}) {
    const active = document.activeElement;
    if (!options.ignoreActive && isTypingTarget(active)) return active;

    const dialogs = querySelectorAllDeep(document, '[role="dialog"], .artdeco-modal');
    const roots = dialogs.length ? [...dialogs, document] : [document];

    for (const root of roots) {
        const target = querySelectorDeep(
            root,
            'textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"], .msg-form__contenteditable'
        );
        if (target) return target;
    }

    return null;
}

function fillTextTarget(target, text) {
    target.focus();

    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        setNativeInputValue(target, text);
    } else {
        const selection = window.getSelection();
        const range = document.createRange();
        target.textContent = "";
        range.selectNodeContents(target);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        const inserted = document.execCommand("insertText", false, text);
        if (!inserted) {
            target.textContent = text;
        }
    }

    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
}

function setNativeInputValue(target, value) {
    const prototype = target.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (valueSetter) {
        valueSetter.call(target, value);
    } else {
        target.value = value;
    }
}

async function fillMessageBoxWithTemplate(template, options = {}) {
    const target = getMessageInputTarget({ ignoreActive: options.ignoreActive === true });
    if (!target) {
        console.log("LinkedIn QuickConnect: no message box found to fill");
        showQuickConnectStatus("No message box found.", true);
        return false;
    }

    const personalizedText = await personalizeTemplate(template);
    fillTextTarget(target, personalizedText);
    console.log("LinkedIn QuickConnect: message filled", personalizedText);
    showQuickConnectStatus(options.successMessage || "Message inserted.");
    return true;
}

async function getSavedText(key, fallback) {
    if (!chrome?.storage?.sync) return fallback;

    try {
        const result = await chrome.storage.sync.get({ [key]: fallback });
        return result[key] || fallback;
    } catch (error) {
        console.log("LinkedIn QuickConnect: storage read failed", error);
        return fallback;
    }
}

async function isExtensionEnabled() {
    if (!chrome?.storage?.sync) return true;

    try {
        const result = await chrome.storage.sync.get({ [EXTENSION_ENABLED_STORAGE_KEY]: true });
        return result[EXTENSION_ENABLED_STORAGE_KEY] !== false;
    } catch (error) {
        console.log("LinkedIn QuickConnect: enabled state read failed", error);
        return true;
    }
}

async function getBrowserMode() {
    return BROWSER_MODE_VM;
}

async function smartConnect() {
    return smartConnectUniversal();
}

async function smartConnectUniversal() {
    return smartConnectVmBrowser();
}

async function smartConnectNormalBrowser() {
    const topCard = getProfileTopCardRoot();

    const connectButton = findProfileActionButton(['Connect'], { exact: true, intent: "connect", preferPrimary: true }) ||
        findTextActionInRoot(topCard, ['Connect'], { exact: true, requirePrimary: true, intent: "connect" }) ||
        findButtonInRoot(topCard, ['Connect'], { exact: true, requirePrimary: true }) ||
        findNormalPrimaryProfileButton(['Connect'], { exact: true });

    if (connectButton) {
        if (!activateElement(connectButton)) {
            showQuickConnectStatus("Blocked right-panel Connect.", true);
            return false;
        }
        showQuickConnectStatus("Connect clicked.");
        return true;
    }

    const moreButton = findProfileActionButton(['More actions', 'More', 'More options', 'See more actions'], { exact: true, intent: "more" }) ||
        findTextActionInRoot(topCard, ['More actions', 'More', 'More options', 'See more actions'], { exact: true, intent: "more" }) ||
        findButtonInRoot(topCard, ['More actions', 'More', 'More options', 'See more actions'], { exact: true, intent: "more" }) ||
        findProfileHeaderButton(['More actions', 'More', 'More options', 'See more actions'], { intent: "more" });
    if (!moreButton) {
        showQuickConnectStatus("Profile More action not found.", true);
        return false;
    }

    if (!activateElement(moreButton)) {
        showQuickConnectStatus("Blocked right-panel More action.", true);
        return false;
    }

    const clicked = await clickOpenProfileMenuActionWithRetry(moreButton, ['Connect'], { exact: true, intent: "connect" });
    showQuickConnectStatus(clicked ? "Connect clicked." : "Connect action not found.", !clicked);
    return clicked;
}

async function smartConnectVmBrowser() {
    const topCard = getProfileTopCardRoot();

    const connectButton = findProfileActionButton(['Connect'], { exact: true, intent: "connect", preferPrimary: true }) ||
        findOrbitaProfileHeaderButton(['Connect'], { exact: true, intent: "connect" }) ||
        findTextActionInRoot(topCard, ['Connect'], { exact: true, requirePrimary: true, intent: "connect" }) ||
        findButtonInRoot(topCard, ['Connect'], { exact: true, requirePrimary: true }) ||
        findOrbitaVisibleProfileButton(['Connect'], { exact: true }) ||
        findOrbitaVisibleTextAction(['Connect'], { exact: true });

    if (connectButton) {
        if (!activateElement(connectButton)) {
            showQuickConnectStatus("Blocked right-panel Connect.", true);
            return false;
        }
        showQuickConnectStatus("Connect clicked.");
        return true;
    }

    const moreButton = findProfileActionButton(['More actions', 'More', 'More options', 'See more actions'], { exact: true, intent: "more" }) ||
        findOrbitaProfileHeaderButton(['More actions', 'More', 'More options', 'See more actions'], { intent: "more" }) ||
        findTextActionInRoot(topCard, ['More actions', 'More', 'More options', 'See more actions'], { exact: true, intent: "more" }) ||
        findButtonInRoot(topCard, ['More actions', 'More', 'More options', 'See more actions'], { exact: true, intent: "more" }) ||
        findOrbitaVisibleProfileButton(['More actions', 'More', 'More options', 'See more actions'], { intent: "more" }) ||
        findProfileHeaderButton(['More actions', 'More', 'More options', 'See more actions'], { intent: "more" });
    if (!moreButton) {
        showQuickConnectStatus("Profile More action not found.", true);
        return false;
    }

    if (!activateElement(moreButton)) {
        showQuickConnectStatus("Blocked right-panel More action.", true);
        return false;
    }

    const clicked = await clickOpenProfileMenuActionWithRetry(moreButton, ['Connect'], { exact: true, intent: "connect" });
    showQuickConnectStatus(clicked ? "Connect clicked." : "Connect action not found.", !clicked);
    return clicked;
}

function findNormalPrimaryProfileButton(possibleTexts, options = {}) {
    return findNormalProfileButton(possibleTexts, { ...options, requirePrimary: true });
}

function findNormalVisibleTextAction(possibleTexts, options = {}) {
    const main = document.querySelector("main");
    if (!main) return null;

    const heading = main.querySelector("h1, .text-heading-xlarge");
    const headingRect = heading?.getBoundingClientRect();
    const normalizedTargets = possibleTexts.map((text) => text.toLowerCase());
    const candidates = Array.from(main.querySelectorAll("button, [role='button'], a[role='button'], button *, [role='button'] *, a[role='button'] *"))
        .filter(isVisibleElement)
        .filter((element) => {
            const values = getElementTextValues(element);
            return normalizedTargets.some((target) => values.some((value) => (
                options.exact ? isExactishButtonText(value, target) : value === target || value.includes(target)
            )));
        })
        .map((element) => element.closest('button, [role="button"], a[role="button"]') || element)
        .filter((element, index, elements) => elements.indexOf(element) === index)
        .filter((element) => isActionCandidate(element) && !isUnsafeRightPanelTarget(element))
        .filter((element) => isNormalProfileActionArea(element, headingRect))
        .filter((element) => !options.preferPrimary || isPrimaryActionButton(element) || !findAnyPrimaryMatch(elementsFromMain(main), normalizedTargets))
        .map((element) => ({
            element,
            score: scoreProfileAction(element, headingRect, {
                preferPrimary: options.preferPrimary,
                rootBonus: isPrimaryActionButton(element) ? -250 : 0
            })
        }))
        .sort((a, b) => a.score - b.score);

    return candidates[0]?.element || null;
}

function findNormalProfileButton(possibleTexts, options = {}) {
    const main = document.querySelector("main");
    const topCard = getProfileTopCardRoot();
    const heading = main?.querySelector("h1, .text-heading-xlarge");
    const headingRect = heading?.getBoundingClientRect();
    const roots = uniqueElements([topCard, main].filter(Boolean));
    const normalizedTargets = possibleTexts.map((text) => text.toLowerCase());
    const candidates = [];

    for (const root of roots) {
        querySelectorAllDeep(root, 'button, [role="button"], a[role="button"]')
            .filter((element) => isActionCandidate(element) && !isUnsafeRightPanelTarget(element))
            .filter((element) => doesButtonMatch(element, normalizedTargets, options))
            .filter((element) => !options.requirePrimary || isPrimaryActionButton(element))
            .filter((element) => {
                if (!headingRect) return root === topCard;
                return root === topCard || isProfileHeaderAction(element, headingRect);
            })
            .forEach((element) => {
                candidates.push({
                    element,
                    score: scoreProfileAction(element, headingRect, {
                        preferPrimary: options.requirePrimary || options.preferPrimary,
                        rootBonus: root === topCard ? -200 : 0
                    })
                });
            });
    }

    candidates.sort((a, b) => a.score - b.score);
    return candidates[0]?.element || null;
}

function isNormalProfileActionArea(element, headingRect) {
    const rect = element.getBoundingClientRect();
    if (!headingRect) {
        return (
            rect.top >= 0 &&
            rect.top <= Math.max(window.innerHeight * 0.8, 900) &&
            rect.left >= 0 &&
            rect.left < Math.max(window.innerWidth * 0.58, 760)
        );
    }

    return (
        rect.top >= headingRect.bottom - 40 &&
        rect.top <= headingRect.bottom + 620 &&
        rect.left >= Math.max(0, headingRect.left - 80) &&
        rect.left < Math.max(window.innerWidth * 0.58, headingRect.left + 760)
    );
}

function elementsFromMain(main) {
    return Array.from(main.querySelectorAll('button, [role="button"], a[role="button"]'));
}

function findAnyPrimaryMatch(elements, normalizedTargets) {
    return elements.some((element) => (
        isActionCandidate(element) &&
        !isUnsafeRightPanelTarget(element) &&
        isPrimaryActionButton(element) &&
        doesButtonMatch(element, normalizedTargets, { exact: true })
    ));
}

function uniqueElements(elements) {
    return elements.filter((element, index) => elements.indexOf(element) === index);
}

function scoreProfileAction(element, headingRect, options = {}) {
    const rect = element.getBoundingClientRect();
    const distance = headingRect
        ? getProfileHeaderDistance(element, headingRect)
        : rect.top + Math.max(0, rect.left);
    const primaryBonus = options.preferPrimary && isPrimaryActionButton(element) ? -1000 : 0;
    return distance + primaryBonus + (options.rootBonus || 0);
}

function isPrimaryActionButton(element) {
    const className = String(element.className || "");
    if (className.includes("artdeco-button--primary")) return true;

    const backgroundColor = window.getComputedStyle(element).backgroundColor;
    const rgb = parseRgb(backgroundColor);
    if (!rgb) return false;

    return rgb.b >= 135 && rgb.g >= 70 && rgb.r <= 80;
}

function parseRgb(value) {
    const match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return null;
    return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3])
    };
}

async function clickOpenProfileMenuActionWithRetry(anchorElement, possibleTexts, options = {}) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        if (attempt > 0) await sleep(120);
        if (clickOpenProfileMenuAction(anchorElement, possibleTexts, options)) return true;
    }

    return false;
}

function isTypingTarget(target) {
    if (!target) return false;
    const tagName = (target.tagName || "").toUpperCase();
    return (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        target.isContentEditable === true ||
        target.closest?.('[contenteditable="true"], [role="textbox"]')
    );
}

async function runQuickConnectAction(action, eventTarget = null) {
    if (window.__ORTUS_F1_CONNECTION_VERSION__ !== QUICKCONNECT_CONTENT_VERSION) return;
    if (isDuplicateAction(action)) return;

    if (!(await isExtensionEnabled())) {
        showQuickConnectStatus("Ortus extension paused.");
        return;
    }

    switch (action) {
        case 'pasteMessage':
            await fillMessageBoxWithTemplate(await getSavedText(TEMPLATE_STORAGE_KEY, DEFAULT_CONNECTION_TEMPLATE), {
                successMessage: "Connection note inserted."
            });
            break;
        case 'connectProfile':
            await smartConnect();
            break;
        case 'moreActions':
            {
                const topCard = getProfileTopCardRoot();
                const moreButton = findProfileActionButton(['More actions', 'More', 'More options', 'See more actions'], { exact: true, intent: "more" }) ||
                    findOrbitaProfileHeaderButton(['More actions', 'More', 'More options', 'See more actions'], { intent: "more" }) ||
                    findTextActionInRoot(topCard, ['More actions', 'More', 'More options', 'See more actions'], { exact: true, intent: "more" }) ||
                    findButtonInRoot(topCard, ['More actions', 'More', 'More options', 'See more actions'], { exact: true, intent: "more" }) ||
                    findOrbitaVisibleProfileButton(['More actions', 'More', 'More options', 'See more actions'], { intent: "more" }) ||
                    findProfileHeaderButton(['More actions', 'More', 'More options', 'See more actions'], { intent: "more" });
                const opened = moreButton ? activateElement(moreButton) : false;
                if (!moreButton) {
                    showQuickConnectStatus("More actions not found.", true);
                } else if (!opened) {
                    showQuickConnectStatus("Blocked right-panel More action.", true);
                } else {
                    showQuickConnectStatus("More actions opened.");
                }
            }
            break;
        case 'addNote':
            if (isTypingTarget(eventTarget)) return;
            if (!clickLinkedInButton(['Add a note'])) {
                showQuickConnectStatus("Add note action not found.", true);
            } else {
                showQuickConnectStatus("Add note clicked.");
            }
            break;
        case 'sendWithoutNote':
            if (isTypingTarget(eventTarget)) return;
            if (!clickLinkedInButton(['Send without a note'])) {
                showQuickConnectStatus("Send without note action not found.", true);
            } else {
                showQuickConnectStatus("Sent without a note.");
            }
            break;
        case 'sendNote':
            if (!clickOpenDialogButton(['Send invitation', 'Send'], { exact: true })) {
                showQuickConnectStatus("Send invitation action not found.", true);
            } else {
                showQuickConnectStatus("Invitation sent.");
            }
            break;
        default:
            break;
    }
}

function isDuplicateAction(action) {
    const now = Date.now();
    const previous = recentActionTimes.get(action) || 0;
    recentActionTimes.set(action, now);
    return now - previous < ACTION_DEBOUNCE_MS;
}

function showQuickConnectStatus(message, isError = false) {
    const id = "quickconnect-status-toast";
    let toast = document.getElementById(id);
    if (!toast) {
        toast = document.createElement("div");
        toast.id = id;
        toast.setAttribute("role", "status");
        toast.style.cssText = [
            "position:fixed",
            "right:18px",
            "bottom:18px",
            "z-index:2147483647",
            "max-width:260px",
            "padding:10px 12px",
            "border-radius:10px",
            "font:600 13px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
            "box-shadow:0 14px 34px rgba(8,12,20,.28)",
            "transition:opacity 160ms ease,transform 160ms ease",
            "opacity:0",
            "transform:translateY(8px)"
        ].join(";");
        document.documentElement.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.color = isError ? "#fff5f5" : "#f8fbff";
    toast.style.background = isError ? "#9f2539" : "#12345f";
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";

    window.clearTimeout(showQuickConnectStatus.timeout);
    showQuickConnectStatus.timeout = window.setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(8px)";
    }, 1800);
}

function getProfileNameFromPage() {
  if (!/\/in\//.test(location.pathname)) return "";
  const h1 = document.querySelector("main h1")
          || document.querySelector("h1.text-heading-xlarge")
          || document.querySelector("h1");
  return (h1?.textContent || "").trim();
}

chrome.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
    if (![QUICKCONNECT_MESSAGE_SOURCE, "quickconnect"].includes(message?.source) || !message.action) return false;

    if (message.action === "diagnoseProfile") {
        getQuickConnectDiagnostics()
            .then((report) => sendResponse({ ok: true, report }))
            .catch((error) => {
                console.log("LinkedIn QuickConnect: diagnosis failed", error);
                sendResponse({ ok: false, error: error.message || "Diagnosis failed." });
            });
        return true;
    }

    if (message.action === "getActiveProfileName") {
        sendResponse({ ok: true, name: getProfileNameFromPage(), url: location.href });
        return true;
    }

    runQuickConnectAction(message.action)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
            console.log("LinkedIn QuickConnect: action failed", error);
            sendResponse({ ok: false });
        });
    return true;
});

// Listen for keyboard shortcuts (use event.code for reliable Option+key on macOS).
document.addEventListener('keydown', async function (e) {
    if (window.__ORTUS_F1_CONNECTION_VERSION__ !== QUICKCONNECT_CONTENT_VERSION) return;
    if (!e.altKey || e.ctrlKey || e.metaKey) return;

    switch (e.code) {
        case 'Enter': // Option + Enter = Send note invitation
        case 'NumpadEnter':
            e.preventDefault();
            await runQuickConnectAction('sendNote', e.target);
            break;
        case 'KeyP': // Option + P = Paste personalized message template
            e.preventDefault();
            await runQuickConnectAction('pasteMessage', e.target);
            break;
        case 'KeyC': // Option + C = Connect
            e.preventDefault();
            await runQuickConnectAction('connectProfile', e.target);
            break;
        case 'KeyM': // Option + M = More actions
            e.preventDefault();
            await runQuickConnectAction('moreActions', e.target);
            break;
        case 'KeyN': // Option + N = Add a note
        case 'KeyA': // Option + A = Add a note (extra direct shortcut)
            e.preventDefault();
            await runQuickConnectAction('addNote', e.target);
            break;
        case 'KeyS': // Option + S = Send without a note
        case 'KeyW': // Option + W = Send without a note (extra direct shortcut)
            e.preventDefault();
            await runQuickConnectAction('sendWithoutNote', e.target);
            break;
        default:
            break;
    }
}, true);
