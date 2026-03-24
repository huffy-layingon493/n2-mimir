// Classifier — determine task domain from user's topic/query
// This is what fires when the user says a topic → orchestrator kicks in

/** Known domain categories */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  'coding_pattern': ['code', 'function', 'class', 'module', 'refactor', 'component', '코드', '함수', '리팩터'],
  'deployment': ['deploy', 'build', 'publish', 'npm', 'vercel', '배포', '빌드'],
  'testing': ['test', 'verify', 'check', 'validate', '테스트', '검증', '확인'],
  'architecture': ['design', 'structure', 'architecture', 'plan', '설계', '아키텍처', '구조'],
  'file_system': ['file', 'path', 'directory', 'folder', '파일', '경로', '폴더', '디렉토리'],
  'configuration': ['config', 'setting', 'env', 'environment', '설정', '환경변수'],
  'version_control': ['git', 'commit', 'branch', 'merge', 'push', 'pull'],
  'api': ['api', 'endpoint', 'request', 'response', 'fetch', 'REST'],
  'database': ['database', 'db', 'query', 'sql', 'table', '데이터베이스'],
  'styling': ['css', 'style', 'design', 'layout', 'tailwind', 'color', '스타일', '디자인'],
  'documentation': ['readme', 'doc', 'documentation', 'comment', '문서', '주석'],
};

/**
 * Classify a user's topic/query into domain categories.
 * Returns matching categories sorted by relevance (most keywords matched first).
 */
export function classify(topic: string): string[] {
  const lowerTopic = topic.toLowerCase();
  const scores: Array<{ category: string; score: number }> = [];

  for (const [category, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const matchCount = keywords.filter((k) => lowerTopic.includes(k)).length;
    if (matchCount > 0) {
      scores.push({ category, score: matchCount });
    }
  }

  // Sort by score descending, return categories
  const sorted = scores.sort((a, b) => b.score - a.score).map((s) => s.category);

  // Always include 'general' as fallback
  return sorted.length > 0 ? sorted : ['general'];
}

/**
 * Extract keywords from topic for FTS5 search.
 * Removes common stop words and returns search-ready terms.
 */
export function extractSearchTerms(topic: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'this', 'that', 'these', 'those', 'it', 'its',
    '이', '그', '저', '것', '를', '을', '에', '에서', '으로', '로',
    '하다', '되다', '있다', '없다', '만들다',
  ]);

  return topic
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9가-힣]/g, ''))
    .filter((w) => w.length > 1 && !stopWords.has(w));
}

/**
 * Decompose a composite query into independent tag layers for intersection search.
 * (architecture.md §8-8 Step 1)
 *
 * Example: "제과점 랜딩페이지 만들어줘" → [["랜딩페이지"], ["제과점"]]
 *
 * Each term that maps to a known domain becomes its own layer.
 * Non-domain terms are grouped into a single "context" layer.
 */
export function decomposeQuery(topic: string): ReadonlyArray<ReadonlyArray<string>> {
  const terms = extractSearchTerms(topic);
  if (terms.length <= 1) return terms.length === 1 ? [terms] : [];

  // Collect all known domain keywords in a lookup
  const domainLookup = new Map<string, string>();
  for (const [_category, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const keyword of keywords) {
      domainLookup.set(keyword, _category);
    }
  }

  // Separate domain terms (each becomes its own layer) from context terms
  const layers: string[][] = [];
  const contextTerms: string[] = [];

  for (const term of terms) {
    if (domainLookup.has(term)) {
      // Domain keyword → its own layer for intersection
      layers.push([term]);
    } else {
      // Non-domain → context layer
      contextTerms.push(term);
    }
  }

  // Group context terms as one layer (if any)
  if (contextTerms.length > 0) {
    layers.push(contextTerms);
  }

  return layers;
}
