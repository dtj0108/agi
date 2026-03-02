/**
 * Search Index
 *
 * SQLite FTS5 full-text search over mind files.
 * Optionally supports vector search via sqlite-vec when embeddings are enabled.
 * Maintains a searchable index of all mind file contents.
 */

import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { readdir, readFile, stat } from 'fs/promises';
import { join, relative } from 'path';

// Try to import sqlite-vec for vector search support
let sqliteVecPath: any = null;
try {
  const sqliteVec = await import('sqlite-vec');
  sqliteVecPath = sqliteVec.getLoadablePath();
} catch {
  // sqlite-vec not installed, vector search will be disabled
}

export class SearchIndex {
  db: any;
  dbPath: any;
  embeddingService: any;
  ftsTable: any;
  mindPath: any;
  stmts: any;
  vectorsEnabled: any;
  constructor(mindPath: any, dbPath: any, embeddingService: any = null) {
    this.mindPath = mindPath;
    this.dbPath = dbPath || join(mindPath, '.index.db');
    this.db = null;
    this.embeddingService = embeddingService;
    this.vectorsEnabled = false;
  }

  /**
   * Initialize the database and create tables
   */
  async initialize() {
    this.db = new Database(this.dbPath);
    this.ftsTable = 'mind_files_fts';

    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');

    // Create the backing content table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mind_files_content (
        id INTEGER PRIMARY KEY,
        path TEXT UNIQUE NOT NULL,
        content TEXT,
        updated_at TEXT,
        checksum TEXT
      )
    `);

    // Create the FTS5 virtual table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${this.ftsTable} USING fts5(
        path,
        content,
        content='mind_files_content',
        content_rowid='id'
      )
    `);

    // Cleanup legacy trigger names from older schema versions
    this.db.exec(`
      DROP TRIGGER IF EXISTS mind_files_ai;
      DROP TRIGGER IF EXISTS mind_files_ad;
      DROP TRIGGER IF EXISTS mind_files_au;
    `);

    // Create triggers to keep FTS in sync with content table
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS mind_files_fts_ai AFTER INSERT ON mind_files_content BEGIN
        INSERT INTO ${this.ftsTable}(rowid, path, content)
        VALUES (NEW.id, NEW.path, NEW.content);
      END
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS mind_files_fts_ad AFTER DELETE ON mind_files_content BEGIN
        INSERT INTO ${this.ftsTable}(${this.ftsTable}, rowid, path, content)
        VALUES ('delete', OLD.id, OLD.path, OLD.content);
      END
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS mind_files_fts_au AFTER UPDATE ON mind_files_content BEGIN
        INSERT INTO ${this.ftsTable}(${this.ftsTable}, rowid, path, content)
        VALUES ('delete', OLD.id, OLD.path, OLD.content);
        INSERT INTO ${this.ftsTable}(rowid, path, content)
        VALUES (NEW.id, NEW.path, NEW.content);
      END
    `);

    // Initialize vector tables if embeddings are enabled
    await this.initializeVectorTables();

    // Prepare common statements
    this.stmts = {
      upsert: this.db.prepare(`
        INSERT INTO mind_files_content (path, content, updated_at, checksum)
        VALUES (@path, @content, @updated_at, @checksum)
        ON CONFLICT(path) DO UPDATE SET
          content = @content,
          updated_at = @updated_at,
          checksum = @checksum
      `),
      remove: this.db.prepare('DELETE FROM mind_files_content WHERE path = ?'),
      search: this.db.prepare(`
        SELECT path, snippet(${this.ftsTable}, 1, '<mark>', '</mark>', '...', 32) as snippet,
               bm25(${this.ftsTable}) as rank
        FROM ${this.ftsTable}
        WHERE ${this.ftsTable} MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `),
      searchCount: this.db.prepare(`
        SELECT COUNT(*) as total FROM ${this.ftsTable} WHERE ${this.ftsTable} MATCH ?
      `),
      getContent: this.db.prepare('SELECT content FROM mind_files_content WHERE path = ?'),
      getAll: this.db.prepare('SELECT path, checksum FROM mind_files_content'),
    };
  }

  /**
   * Compute SHA-256 checksum of content
   */
  computeChecksum(content: any) {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Index a file (add or update)
   * Optionally generates embedding if service is available
   */
  async indexFile(path: any, content: any, generateEmbedding: any = true) {
    const relativePath = relative(this.mindPath, path);
    const checksum = this.computeChecksum(content);
    const updatedAt = new Date().toISOString();

    this.stmts.upsert.run({
      path: relativePath,
      content,
      updated_at: updatedAt,
      checksum,
    });

    // Generate and store embedding if enabled
    if (generateEmbedding && this.hasEmbeddings()) {
      await this.indexEmbedding(relativePath, content);
    }

    return { path: relativePath, checksum };
  }

  /**
   * Remove a file from the index
   */
  removeFile(path: any) {
    const relativePath = relative(this.mindPath, path);

    // Remove embedding first if vectors are enabled
    if (this.hasEmbeddings()) {
      const contentRow = this.stmts.getContentId?.get(relativePath);
      if (contentRow) {
        this.stmts.deleteEmbedding?.run(contentRow.id);
      }
    }

    this.stmts.remove.run(relativePath);
    return { path: relativePath };
  }

  /**
   * Search the index
   */
  search(query: any, options: any = {}) {
    const limit = options.limit || 10;
    const offset = options.offset || 0;

    // Escape special FTS5 characters in the query
    const escapedQuery = this.escapeQuery(query);

    try {
      const results = this.stmts.search.all(escapedQuery, limit, offset);
      const countResult = this.stmts.searchCount.get(escapedQuery);

      return {
        results: results.map((r: any) => ({
          path: r.path,
          snippet: r.snippet,
          rank: r.rank,
        })),
        total: countResult?.total || 0,
        query,
      };
    } catch (error: any) {
      // If the query is invalid, return empty results
      if (error.message.includes('fts5')) {
        return { results: [], total: 0, query, error: 'Invalid search query' };
      }
      throw error;
    }
  }

  /**
   * Escape special FTS5 query characters
   */
  escapeQuery(query: any) {
    // For simple queries, wrap terms in quotes for exact matching
    // For advanced queries (containing AND, OR, NOT, quotes), pass through
    if (query.includes('"') || query.includes(' AND ') ||
        query.includes(' OR ') || query.includes(' NOT ')) {
      return query;
    }

    // Simple query: search for all terms
    return query
      .split(/\s+/)
      .filter((term: any) => term.length > 0)
      .map((term: any) => `"${term}"`)
      .join(' ');
  }

  /**
   * Get content of a specific file from the index
   */
  getFileContent(path: any) {
    const relativePath = relative(this.mindPath, path);
    const result = this.stmts.getContent.get(relativePath);
    return result?.content || null;
  }

  /**
   * Rebuild the entire index from the filesystem
   */
  async rebuildIndex(includeEmbeddings: any = true) {
    // Clear existing data
    this.db.exec('DELETE FROM mind_files_content');

    // Clear embeddings if they exist
    if (this.hasEmbeddings()) {
      this.db.exec('DELETE FROM mind_files_embeddings');
    }

    // Recursively index all files
    const files = await this.getAllFiles(this.mindPath);
    let indexed = 0;

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, 'utf-8');
        await this.indexFile(filePath, content, includeEmbeddings);
        indexed++;
      } catch {
        // Skip files that can't be read
      }
    }

    return { indexed, total: files.length };
  }

  /**
   * Get all files in a directory recursively
   */
  async getAllFiles(dirPath: any, files: any = []) {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      // Skip hidden files and directories
      if (entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.getAllFiles(fullPath, files);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Get all indexed files with their checksums
   */
  getAllIndexed() {
    return this.stmts.getAll.all();
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Initialize vector tables if embeddings are enabled
   */
  async initializeVectorTables() {
    if (!this.embeddingService?.isEnabled()) {
      this.vectorsEnabled = false;
      return;
    }

    try {
      // Load sqlite-vec extension
      if (!sqliteVecPath) {
        console.warn('sqlite-vec not installed. Vector search disabled.');
        console.warn('Run: npm install sqlite-vec');
        this.vectorsEnabled = false;
        return;
      }

      this.db.loadExtension(sqliteVecPath);

      const dimensions = this.embeddingService.getDimensions();

      // Create embeddings storage table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS mind_files_embeddings (
          id INTEGER PRIMARY KEY,
          content_id INTEGER UNIQUE REFERENCES mind_files_content(id),
          embedding BLOB,
          model TEXT,
          embedded_at TEXT
        )
      `);

      // Create index on content_id for faster lookups
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_embeddings_content_id
        ON mind_files_embeddings(content_id)
      `);

      // Prepare vector statements
      this.stmts.getContentId = this.db.prepare(
        'SELECT id FROM mind_files_content WHERE path = ?'
      );

      this.stmts.upsertEmbedding = this.db.prepare(`
        INSERT INTO mind_files_embeddings (content_id, embedding, model, embedded_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(content_id) DO UPDATE SET
          embedding = excluded.embedding,
          model = excluded.model,
          embedded_at = excluded.embedded_at
      `);

      this.stmts.getEmbedding = this.db.prepare(
        'SELECT embedding FROM mind_files_embeddings WHERE content_id = ?'
      );

      this.stmts.deleteEmbedding = this.db.prepare(
        'DELETE FROM mind_files_embeddings WHERE content_id = ?'
      );

      this.stmts.getAllEmbeddings = this.db.prepare(`
        SELECT mfc.path, mfc.content, mfe.embedding
        FROM mind_files_embeddings mfe
        JOIN mind_files_content mfc ON mfc.id = mfe.content_id
      `);

      this.vectorsEnabled = true;
      console.log(`Vector search enabled (${dimensions} dimensions)`);
    } catch (error: any) {
      console.warn('Failed to initialize vector tables:', error.message);
      this.vectorsEnabled = false;
    }
  }

  /**
   * Check if vector search is available
   */
  hasEmbeddings() {
    return this.vectorsEnabled && this.embeddingService?.isEnabled();
  }

  /**
   * Index embedding for a file
   */
  async indexEmbedding(relativePath: any, content: any) {
    if (!this.hasEmbeddings()) return null;

    try {
      // Get content ID
      const contentRow = this.stmts.getContentId.get(relativePath);
      if (!contentRow) return null;

      // Generate embedding
      const embedding = await this.embeddingService.embed(content);
      const embeddingBlob = this.embeddingService.toBlob(embedding);

      // Store embedding
      this.stmts.upsertEmbedding.run(
        contentRow.id,
        embeddingBlob,
        this.embeddingService.getModel(),
        new Date().toISOString()
      );

      return { path: relativePath, dimensions: embedding.length };
    } catch (error: any) {
      console.warn(`Failed to index embedding for ${relativePath}:`, error.message);
      return null;
    }
  }

  /**
   * Semantic vector search
   */
  async vectorSearch(query: any, options: any = {}) {
    if (!this.hasEmbeddings()) {
      return { results: [], total: 0, query, error: 'Vector search not enabled' };
    }

    const limit = options.limit || 10;
    const minSimilarity = options.minSimilarity || 0.0;

    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.embed(query);

      // Get all embeddings and compute similarities
      // Note: For large datasets, this should use sqlite-vec's native search
      // For now, we do it in JS for compatibility
      const allEmbeddings = this.stmts.getAllEmbeddings.all();

      const results = allEmbeddings
        .map((row: any) => {
          const docEmbedding = this.embeddingService.fromBlob(row.embedding);
          const similarity = this.embeddingService.cosineSimilarity(queryEmbedding, docEmbedding);
          return {
            path: row.path,
            content: row.content,
            similarity,
          };
        })
        .filter((r: any) => r.similarity >= minSimilarity)
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, limit);

      return {
        results,
        total: results.length,
        query,
        method: 'vector',
      };
    } catch (error: any) {
      return { results: [], total: 0, query, error: error.message };
    }
  }

  /**
   * Hybrid search combining FTS5 + vector similarity
   */
  async hybridSearch(query: any, options: any = {}) {
    const limit = options.limit || 10;
    const vectorWeight = options.vectorWeight ?? 0.6;
    const ftsWeight = options.ftsWeight ?? 0.4;
    const minScore = options.minScore ?? 0.0;

    // Run FTS search
    const ftsResults = this.search(query, { limit: limit * 2 });

    // Run vector search if available
    let vectorResults: any = { results: [] };
    if (this.hasEmbeddings()) {
      vectorResults = await this.vectorSearch(query, { limit: limit * 2 });
    }

    // If no vector results, just return FTS results
    if (vectorResults.results.length === 0) {
      return {
        results: ftsResults.results.map((r: any) => ({
          ...r,
          combinedScore: 1.0, // FTS only
          ftsScore: 1.0,
          vectorScore: 0,
        })).slice(0, limit),
        total: Math.min(ftsResults.total, limit),
        query,
        method: 'fts_only',
      };
    }

    // Combine and score results
    const scoreMap = new Map();

    // Process FTS results (BM25 scores are negative, lower is better)
    if (ftsResults.results.length > 0) {
      const maxRank = Math.max(...ftsResults.results.map((r: any) => Math.abs(r.rank))) || 1;
      for (const result of ftsResults.results) {
        const normalizedScore = 1 - (Math.abs(result.rank) / maxRank);
        scoreMap.set(result.path, {
          path: result.path,
          snippet: result.snippet,
          ftsScore: normalizedScore,
          vectorScore: 0,
        });
      }
    }

    // Process vector results
    for (const result of vectorResults.results) {
      const existing = scoreMap.get(result.path);
      if (existing) {
        existing.vectorScore = result.similarity;
        existing.content = result.content;
      } else {
        scoreMap.set(result.path, {
          path: result.path,
          content: result.content,
          ftsScore: 0,
          vectorScore: result.similarity,
        });
      }
    }

    // Calculate combined scores and filter
    const combined = Array.from(scoreMap.values())
      .map((item: any) => ({
        ...item,
        combinedScore: (item.ftsScore * ftsWeight) + (item.vectorScore * vectorWeight),
      }))
      .filter((item: any) => item.combinedScore >= minScore)
      .sort((a: any, b: any) => b.combinedScore - a.combinedScore)
      .slice(0, limit);

    return {
      results: combined,
      total: combined.length,
      query,
      method: 'hybrid',
      weights: { vector: vectorWeight, fts: ftsWeight },
    };
  }
}
