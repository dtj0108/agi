/**
 * HTTP Request Skill
 *
 * Make HTTP requests to external APIs and websites.
 */
import { BaseSkill } from '../../base-skill.js';
export default class HttpRequestSkill extends BaseSkill {
    execute(action: any, params: any): Promise<{
        status: number;
        statusText: string;
        headers: {
            [k: string]: string;
        };
        body: any;
    }>;
    /**
     * Validate URL against allowed/blocked domains
     */
    validateUrl(urlString: any): any;
    /**
     * Detect local/private network targets that should be blocked.
     */
    isPrivateTarget(hostname: any): boolean;
    /**
     * Make an HTTP GET request
     */
    get({ url, headers }: any): Promise<{
        status: number;
        statusText: string;
        headers: {
            [k: string]: string;
        };
        body: any;
    }>;
    /**
     * Make an HTTP POST request
     */
    post({ url, body, headers }: any): Promise<{
        status: number;
        statusText: string;
        headers: {
            [k: string]: string;
        };
        body: any;
    }>;
    /**
     * Make a custom HTTP request
     */
    request({ url, method, body, headers }: any): Promise<{
        status: number;
        statusText: string;
        headers: {
            [k: string]: string;
        };
        body: any;
    }>;
}
//# sourceMappingURL=index.d.ts.map