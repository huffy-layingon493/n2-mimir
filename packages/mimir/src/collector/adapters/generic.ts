// Generic adapter — direct experience injection (API-driven)
import type { ExperienceAdapter, RawExperience } from '../../types.js';

/**
 * Generic adapter: holds manually injected experiences.
 * Used when experiences are provided directly via the Mimir API
 * rather than collected from external data sources.
 */
export class GenericAdapter implements ExperienceAdapter {
  private readonly buffer: RawExperience[] = [];

  /** Add an experience to the buffer for next collection */
  push(experience: RawExperience): void {
    this.buffer.push(experience);
  }

  /** Add multiple experiences */
  pushBatch(experiences: ReadonlyArray<RawExperience>): void {
    this.buffer.push(...experiences);
  }

  async collect(_project: string, _agent: string): Promise<ReadonlyArray<RawExperience>> {
    const collected = [...this.buffer];
    this.buffer.length = 0;
    return collected;
  }
}
