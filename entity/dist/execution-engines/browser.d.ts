/**
 * Browser Controller
 *
 * Controls a Puppeteer browser instance with semantic snapshots.
 * Lazy-launches browser on first use.
 */
export declare class BrowserController {
    allowedDomains: any;
    browser: any;
    config: any;
    currentRefMap: any;
    headless: any;
    page: any;
    screenshotDir: any;
    timeout: any;
    constructor(config: any);
    /**
     * Launch the browser if not already running
     */
    launch(): Promise<void>;
    /**
     * Execute a browser action
     */
    execute(params: any): Promise<{
        success: boolean;
    }>;
    /**
     * Navigate to a URL
     */
    navigate(url: any): Promise<{
        success: boolean;
        error: string;
        attemptedUrl: any;
        attemptedDomain: string;
        domainAllowed: boolean;
        url?: undefined;
        title?: undefined;
    } | {
        success: boolean;
        url: any;
        title: any;
        domainAllowed: boolean;
        error?: undefined;
        attemptedUrl?: undefined;
        attemptedDomain?: undefined;
    }>;
    /**
     * Check if a domain is allowed (exact match or subdomain)
     */
    isDomainAllowed(domain: any): boolean;
    /**
     * Take a screenshot
     */
    screenshot(): Promise<{
        success: boolean;
        path: string;
    }>;
    /**
     * Get semantic snapshot via accessibility tree
     */
    getSemanticSnapshot(): Promise<{
        success: boolean;
        error: string;
        snapshot?: undefined;
        elementCount?: undefined;
        pageUrl?: undefined;
        pageTitle?: undefined;
    } | {
        success: boolean;
        snapshot: string;
        elementCount: number;
        pageUrl: any;
        pageTitle: any;
        error?: undefined;
    }>;
    /**
     * Get DOM text content
     */
    getDom(): Promise<{
        success: boolean;
        content: any;
        url: any;
    }>;
    /**
     * Click an element by reference number
     */
    click(ref: any): Promise<{
        success: boolean;
        error: string;
    } | {
        success: boolean;
        error?: undefined;
    }>;
    /**
     * Type into an element by reference number
     */
    type(ref: any, text: any): Promise<{
        success: boolean;
        error: string;
    } | {
        success: boolean;
        error?: undefined;
    }>;
    /**
     * Find an element by accessibility reference
     */
    findElementByRef(ref: any): Promise<any>;
    /**
     * Scroll the page
     */
    scroll(direction?: any, amount?: any): Promise<{
        success: boolean;
    }>;
    /**
     * Wait for a duration
     */
    wait(ms: any): Promise<{
        success: boolean;
    }>;
    /**
     * Evaluate JavaScript on the page
     */
    evaluate(script: any): Promise<{
        success: boolean;
        result: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        result?: undefined;
    }>;
    /**
     * Navigate back
     */
    back(): Promise<{
        success: boolean;
        url: any;
    }>;
    /**
     * Navigate forward
     */
    forward(): Promise<{
        success: boolean;
        url: any;
    }>;
    /**
     * Refresh the page
     */
    refresh(): Promise<{
        success: boolean;
        url: any;
    }>;
    /**
     * Close the browser
     */
    close(): Promise<void>;
}
//# sourceMappingURL=browser.d.ts.map