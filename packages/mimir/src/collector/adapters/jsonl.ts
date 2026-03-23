// JSONL adapter — standalone experience source (no Soul dependency)
import type { ExperienceAdapter, RawExperience } from '../../types.js';
import { readFileSync, existsSync } from 'fs';

/**
 * JSONL adapter: reads experiences from a JSON Lines file.
 * Each line = one JSON object representing a raw experience.
 * This is the primary adapter for standalone (non-Soul) mode.
 */
export class JsonlAdapter implements ExperienceAdapter {
  constructor(private readonly filePath: string) {}

  async collect(_project: string, _agent: string): Promise<ReadonlyArray<RawExperience>> {
    if (!existsSync(this.filePath)) return [];

    const content = readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\n').filter((line: string) => line.trim().length > 0);
    const experiences: RawExperience[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as RawExperience;
        if (parsed.action && parsed.outcome) {
          experiences.push(parsed);
        }
      } catch {
        // Skip malformed lines
      }
    }

    return experiences;
  }
}
