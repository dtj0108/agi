/**
 * Browser Controller
 *
 * Controls a Puppeteer browser instance with semantic snapshots.
 * Lazy-launches browser on first use.
 */
import puppeteer from 'puppeteer';
import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
export class BrowserController {
    allowedDomains;
    browser;
    config;
    currentRefMap;
    headless;
    page;
    screenshotDir;
    timeout;
    constructor(config) {
        this.config = config;
        this.browser = null;
        this.page = null;
        this.allowedDomains = new Set((config.actions?.browser?.allowedDomains || [])
            .map((domain) => String(domain).trim().toLowerCase())
            .filter(Boolean));
        this.screenshotDir = config.actions?.browser?.screenshotDir ||
            join(config.projectRoot || '.', 'entity-workspace/temp/screenshots');
        this.headless = config.actions?.browser?.headless !== false;
        this.timeout = config.actions?.browser?.timeout || 60000;
        this.currentRefMap = new Map();
    }
    /**
     * Launch the browser if not already running
     */
    async launch() {
        if (this.browser)
            return;
        this.browser = await puppeteer.launch({
            headless: Boolean(this.headless),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        });
        this.page = await this.browser.newPage();
        // Set viewport
        await this.page.setViewport({
            width: this.config.actions?.browser?.viewportWidth || 1280,
            height: this.config.actions?.browser?.viewportHeight || 720,
        });
        // Set default timeout
        this.page.setDefaultTimeout(this.timeout);
    }
    /**
     * Execute a browser action
     */
    async execute(params) {
        await this.launch();
        const { action } = params;
        switch (action) {
            case 'navigate':
                return this.navigate(params.url);
            case 'screenshot':
                return this.screenshot();
            case 'getSemanticSnapshot':
                return this.getSemanticSnapshot();
            case 'getDom':
                return this.getDom();
            case 'click':
                return this.click(params.ref);
            case 'type':
                return this.type(params.ref, params.text);
            case 'scroll':
                return this.scroll(params.direction, params.amount);
            case 'wait':
                return this.wait(params.ms || 1000);
            case 'evaluate':
                return this.evaluate(params.script);
            case 'back':
                return this.back();
            case 'forward':
                return this.forward();
            case 'refresh':
                return this.refresh();
            default:
                throw new Error(`Unknown browser action: ${action}`);
        }
    }
    /**
     * Navigate to a URL
     */
    async navigate(url) {
        const parsedUrl = new URL(url);
        const domain = parsedUrl.hostname.toLowerCase();
        const isAllowed = this.isDomainAllowed(domain);
        if (!isAllowed) {
            return {
                success: false,
                error: 'Domain not allowed',
                attemptedUrl: url,
                attemptedDomain: domain,
                domainAllowed: false,
            };
        }
        await this.page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: this.timeout,
        });
        return {
            success: true,
            url: this.page.url(),
            title: await this.page.title(),
            domainAllowed: isAllowed,
        };
    }
    /**
     * Check if a domain is allowed (exact match or subdomain)
     */
    isDomainAllowed(domain) {
        if (this.allowedDomains.size === 0)
            return true;
        for (const allowed of this.allowedDomains) {
            if (domain === allowed || domain.endsWith(`.${allowed}`)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Take a screenshot
     */
    async screenshot() {
        // Ensure directory exists
        if (!existsSync(this.screenshotDir)) {
            mkdirSync(this.screenshotDir, { recursive: true });
        }
        const filename = `screenshot-${Date.now()}.png`;
        const filepath = join(this.screenshotDir, filename);
        await this.page.screenshot({
            path: filepath,
            fullPage: false,
        });
        return {
            success: true,
            path: filepath,
        };
    }
    /**
     * Get semantic snapshot via accessibility tree
     */
    async getSemanticSnapshot() {
        const snapshot = await this.page.accessibility.snapshot({
            interestingOnly: true,
        });
        if (!snapshot) {
            return {
                success: false,
                error: 'Could not get accessibility snapshot',
            };
        }
        // Convert tree to flat text with reference numbers
        const lines = [];
        let refCounter = 0;
        this.currentRefMap.clear();
        const traverse = (node, depth = 0) => {
            if (!node)
                return;
            const ref = refCounter++;
            const indent = '  '.repeat(depth);
            // Build the line
            let line = `${indent}${node.role}`;
            // Add name if present
            if (node.name) {
                line += ` "${node.name}"`;
            }
            // Add value if present (for inputs)
            if (node.value !== undefined && node.value !== '') {
                line += ` value="${node.value}"`;
            }
            // Add states
            const states = [];
            if (node.checked !== undefined) {
                states.push(node.checked ? 'checked' : 'unchecked');
            }
            if (node.disabled)
                states.push('disabled');
            if (node.expanded !== undefined) {
                states.push(node.expanded ? 'expanded' : 'collapsed');
            }
            if (node.focused)
                states.push('focused');
            if (node.selected)
                states.push('selected');
            if (states.length > 0) {
                line += ` (${states.join(', ')})`;
            }
            // Add reference number
            line += ` [ref=${ref}]`;
            lines.push(line);
            this.currentRefMap.set(ref, node);
            // Traverse children
            if (node.children) {
                for (const child of node.children) {
                    traverse(child, depth + 1);
                }
            }
        };
        traverse(snapshot);
        return {
            success: true,
            snapshot: lines.join('\n'),
            elementCount: refCounter,
            pageUrl: this.page.url(),
            pageTitle: await this.page.title(),
        };
    }
    /**
     * Get DOM text content
     */
    async getDom() {
        const content = await this.page.evaluate(() => {
            const extractText = (element) => {
                let text = '';
                if (element.nodeType === Node.TEXT_NODE) {
                    const trimmed = element.textContent.trim();
                    if (trimmed)
                        text += trimmed + '\n';
                }
                for (const child of element.childNodes) {
                    text += extractText(child);
                }
                return text;
            };
            return extractText(document.body);
        });
        return {
            success: true,
            content,
            url: this.page.url(),
        };
    }
    /**
     * Click an element by reference number
     */
    async click(ref) {
        const element = await this.findElementByRef(ref);
        if (!element) {
            return { success: false, error: `Element with ref=${ref} not found` };
        }
        await element.click();
        // Wait for potential navigation
        await this.page.waitForNetworkIdle({ idleTime: 500 }).catch(() => { });
        return { success: true };
    }
    /**
     * Type into an element by reference number
     */
    async type(ref, text) {
        const element = await this.findElementByRef(ref);
        if (!element) {
            return { success: false, error: `Element with ref=${ref} not found` };
        }
        await element.type(text);
        return { success: true };
    }
    /**
     * Find an element by accessibility reference
     */
    async findElementByRef(ref) {
        const nodeInfo = this.currentRefMap.get(ref);
        if (!nodeInfo)
            return null;
        const role = nodeInfo.role;
        const name = nodeInfo.name;
        // Try various strategies to find the element
        try {
            // Try aria-label
            if (name) {
                let element = await this.page.$(`[aria-label="${name}"]`);
                if (element)
                    return element;
                // Try by text content for links/buttons
                if (role === 'link') {
                    const links = await this.page.$$('a');
                    for (const link of links) {
                        const text = await link.evaluate((el) => el.textContent?.trim());
                        if (text === name)
                            return link;
                    }
                }
                if (role === 'button') {
                    const buttons = await this.page.$$('button');
                    for (const btn of buttons) {
                        const text = await btn.evaluate((el) => el.textContent?.trim());
                        if (text === name)
                            return btn;
                    }
                }
                // Try by placeholder for inputs
                if (role === 'textbox') {
                    let input = await this.page.$(`input[placeholder="${name}"]`);
                    if (input)
                        return input;
                    input = await this.page.$(`input[name="${name}"]`);
                    if (input)
                        return input;
                }
            }
        }
        catch {
            // Element not found by any strategy
        }
        return null;
    }
    /**
     * Scroll the page
     */
    async scroll(direction = 'down', amount = 300) {
        const deltaY = direction === 'down' ? amount : -amount;
        await this.page.evaluate((dy) => {
            window.scrollBy(0, dy);
        }, deltaY);
        return { success: true };
    }
    /**
     * Wait for a duration
     */
    async wait(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return { success: true };
    }
    /**
     * Evaluate JavaScript on the page
     */
    async evaluate(script) {
        try {
            const result = await this.page.evaluate(script);
            return { success: true, result };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    /**
     * Navigate back
     */
    async back() {
        await this.page.goBack();
        return { success: true, url: this.page.url() };
    }
    /**
     * Navigate forward
     */
    async forward() {
        await this.page.goForward();
        return { success: true, url: this.page.url() };
    }
    /**
     * Refresh the page
     */
    async refresh() {
        await this.page.reload();
        return { success: true, url: this.page.url() };
    }
    /**
     * Close the browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}
//# sourceMappingURL=browser.js.map