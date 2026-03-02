/**
 * Web Search Skill
 *
 * Search the web using DuckDuckGo (no API key) or Google Custom Search.
 */

import { BaseSkill } from '../../base-skill.js';

export default class WebSearchSkill extends BaseSkill {
  async execute(action, params) {
    switch (action) {
      case 'search':
        return this.search(params);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async search({ query, engine = 'duckduckgo', limit = 5 }) {
    if (engine === 'duckduckgo') {
      return this.searchDuckDuckGo(query, limit);
    }

    if (engine === 'google') {
      if (!this.config.googleApiKey || !this.config.googleCseId) {
        throw new Error('Google search requires googleApiKey and googleCseId in config');
      }
      return this.searchGoogle(query, limit);
    }

    throw new Error(`Unknown search engine: ${engine}`);
  }

  /**
   * Search using DuckDuckGo Instant Answer API
   * Note: This API returns instant answers, not full search results
   */
  async searchDuckDuckGo(query, limit) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`DuckDuckGo API error: ${response.status}`);
    }

    const data = await response.json();
    const results = [];

    // Abstract (main answer)
    if (data.Abstract) {
      results.push({
        title: data.Heading || 'Answer',
        snippet: data.Abstract,
        url: data.AbstractURL || '',
        source: data.AbstractSource || 'DuckDuckGo',
      });
    }

    // Related topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, limit - results.length)) {
        if (topic.Text && !topic.Topics) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 50),
            snippet: topic.Text,
            url: topic.FirstURL || '',
            source: 'DuckDuckGo',
          });
        }
      }
    }

    // If no results from instant answers, try the HTML search
    if (results.length === 0) {
      return this.searchDuckDuckGoHTML(query, limit);
    }

    return {
      query,
      engine: 'duckduckgo',
      results: results.slice(0, limit),
      total: results.length,
    };
  }

  /**
   * Fallback: Scrape DuckDuckGo HTML (basic)
   */
  async searchDuckDuckGoHTML(query, limit) {
    // DuckDuckGo lite version is more scrape-friendly
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Entity/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo search error: ${response.status}`);
    }

    const html = await response.text();
    const results = [];

    // Basic regex extraction from lite.duckduckgo.com
    // Format: <a rel="nofollow" href="URL" class='result-link'>TITLE</a>
    const linkRegex = /<a[^>]*class=['"]result-link['"][^>]*href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/gi;
    const snippetRegex = /<td[^>]*class=['"]result-snippet['"][^>]*>([^<]+)<\/td>/gi;

    let match;
    const urls = [];
    const titles = [];
    const snippets = [];

    while ((match = linkRegex.exec(html)) !== null) {
      urls.push(match[1]);
      titles.push(match[2]);
    }

    while ((match = snippetRegex.exec(html)) !== null) {
      snippets.push(match[1].trim());
    }

    for (let i = 0; i < Math.min(urls.length, limit); i++) {
      results.push({
        title: titles[i] || 'No title',
        snippet: snippets[i] || '',
        url: urls[i],
        source: 'DuckDuckGo',
      });
    }

    return {
      query,
      engine: 'duckduckgo',
      results,
      total: results.length,
    };
  }

  /**
   * Search using Google Custom Search API
   */
  async searchGoogle(query, limit) {
    const { googleApiKey, googleCseId } = this.config;

    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', googleApiKey);
    url.searchParams.set('cx', googleCseId);
    url.searchParams.set('q', query);
    url.searchParams.set('num', String(Math.min(limit, 10)));

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Google API error: ${error.error?.message || response.status}`);
    }

    const data = await response.json();
    const results = (data.items || []).map(item => ({
      title: item.title,
      snippet: item.snippet,
      url: item.link,
      source: 'Google',
    }));

    return {
      query,
      engine: 'google',
      results,
      total: data.searchInformation?.totalResults || results.length,
    };
  }
}
