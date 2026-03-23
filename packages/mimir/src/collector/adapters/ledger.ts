// collector/adapters/ledger.ts — Soul Ledger adapter (architecture.md 4-2)
// Converts Soul Ledger entries (immutable JSON) into ExperienceEntry format

import type { ExperienceAdapter, RawExperience } from '../../types.js';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

/** Ledger entry structure (from Soul's ledger JSON files) */
interface LedgerEntry {
  readonly title?: string;
  readonly summary?: string;
  readonly agent?: string;
  readonly todo?: ReadonlyArray<string>;
  readonly decisions?: ReadonlyArray<string>;
  readonly insights?: ReadonlyArray<string>;
  readonly filesCreated?: ReadonlyArray<{ path: string; desc: string }>;
  readonly filesModified?: ReadonlyArray<{ path: string; desc: string }>;
  readonly timestamp?: string;
}

/**
 * LedgerAdapter — reads Soul Ledger JSON files and converts to RawExperience.
 *
 * Ledger path: soul/data/projects/{project}/ledger/YYYY/MM/DD/*.json
 *
 * Each ledger entry represents a completed work session.
 * Decisions and insights become individual experiences.
 */
export class LedgerAdapter implements ExperienceAdapter {
  private readonly soulDataPath: string;

  /**
   * @param soulDataPath - Path to soul/data directory
   */
  constructor(soulDataPath: string) {
    this.soulDataPath = soulDataPath;
  }

  async collect(project: string, agent: string): Promise<ReadonlyArray<RawExperience>> {
    const ledgerPath = join(this.soulDataPath, 'projects', project, 'ledger');
    const experiences: RawExperience[] = [];

    try {
      const entries = await this.readAllLedgerEntries(ledgerPath);

      for (const entry of entries) {
        // Filter by agent if specified in ledger entry
        if (agent && entry.agent && entry.agent !== agent) {
          continue;
        }

        // Convert decisions to correction-type experiences
        if (entry.decisions) {
          for (const decision of entry.decisions) {
            experiences.push({
              action: decision,
              outcome: 'Decision recorded in ledger',
              context: entry.title ?? entry.summary ?? 'Work session',
              type: 'pattern',
              category: this.classifyDecision(decision),
              severity: 'info',
              agent: entry.agent ?? agent,
              project,
              timestamp: entry.timestamp,
              sourceRef: `ledger/${project}`,
            });
          }
        }

        // Convert insights to pattern experiences
        if (entry.insights) {
          for (const insight of entry.insights) {
            experiences.push({
              action: insight,
              outcome: 'Insight extracted from work session',
              context: entry.title ?? entry.summary ?? 'Work session',
              type: 'pattern',
              category: this.classifyInsight(insight),
              severity: 'info',
              agent: entry.agent ?? agent,
              project,
              timestamp: entry.timestamp,
              sourceRef: `ledger/${project}`,
            });
          }
        }

        // Convert summary to a session experience
        if (entry.summary) {
          experiences.push({
            action: entry.summary,
            outcome: entry.title ?? 'Work completed',
            context: `Session by ${entry.agent ?? agent}`,
            type: 'success',
            category: 'workflow',
            severity: 'info',
            agent: entry.agent ?? agent,
            project,
            timestamp: entry.timestamp,
            sourceRef: `ledger/${project}`,
          });
        }
      }
    } catch {
      // Ledger directory might not exist — that's OK
    }

    return experiences;
  }

  /** Read all ledger JSON files recursively */
  private async readAllLedgerEntries(basePath: string): Promise<LedgerEntry[]> {
    const entries: LedgerEntry[] = [];

    try {
      const items = await readdir(basePath, { withFileTypes: true, recursive: true });
      for (const item of items) {
        if (item.isFile() && item.name.endsWith('.json')) {
          try {
            const fullPath = join(item.parentPath ?? basePath, item.name);
            const content = await readFile(fullPath, 'utf-8');
            const entry = JSON.parse(content) as LedgerEntry;
            entries.push(entry);
          } catch {
            // Skip malformed entries
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return entries;
  }

  /** Simple keyword-based decision classification */
  private classifyDecision(decision: string): string {
    const lower = decision.toLowerCase();
    if (lower.includes('타입') || lower.includes('type') || lower.includes('interface')) return 'coding_pattern';
    if (lower.includes('파일') || lower.includes('경로') || lower.includes('path')) return 'path_navigation';
    if (lower.includes('설치') || lower.includes('install') || lower.includes('npm')) return 'tool_usage';
    if (lower.includes('설계') || lower.includes('architect') || lower.includes('구조')) return 'architecture';
    if (lower.includes('보안') || lower.includes('권한') || lower.includes('security')) return 'security';
    return 'workflow';
  }

  /** Simple keyword-based insight classification */
  private classifyInsight(insight: string): string {
    return this.classifyDecision(insight);
  }
}
