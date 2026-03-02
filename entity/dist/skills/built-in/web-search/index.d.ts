/**
 * Web Search Skill
 *
 * Search the web using DuckDuckGo (no API key) or Google Custom Search.
 */
import { BaseSkill } from '../../base-skill.js';
export default class WebSearchSkill extends BaseSkill {
    execute(action: any, params: any): Promise<{
        query: any;
        engine: string;
        results: any;
        total: any;
    }>;
    search({ query, engine, limit }: any): Promise<{
        query: any;
        engine: string;
        results: any;
        total: any;
    }>;
    /**
     * Search using DuckDuckGo Instant Answer API
     * Note: This API returns instant answers, not full search results
     */
    searchDuckDuckGo(query: any, limit: any): Promise<{
        query: any;
        engine: string;
        results: any[];
        total: number;
    }>;
    /**
     * Fallback: Scrape DuckDuckGo HTML (basic)
     */
    searchDuckDuckGoHTML(query: any, limit: any): Promise<{
        query: any;
        engine: string;
        results: any[];
        total: number;
    }>;
    /**
     * Search using Google Custom Search API
     */
    searchGoogle(query: any, limit: any): Promise<{
        query: any;
        engine: string;
        results: any;
        total: any;
    }>;
}
//# sourceMappingURL=index.d.ts.map