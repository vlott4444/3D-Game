import { cast } from "./cast.js";

export type CouncilPlan = {
  speakers: string[];
  reason: "named" | "others" | "everyone" | "followup" | "topic";
};
export type CouncilTurn = {
  requestId: string;
  active: boolean;
  currentNpcId: string | null;
  members: {
    id: string;
    name: string;
    title: string;
    status: "waiting" | "thinking" | "answered" | "abstained" | "error";
  }[];
  silent: { id: string; name: string; title: string }[];
};
function normalize(text: string) {
  return text.toLowerCase().replace(/ё/g, "е");
}
function words(text: string) {
  return normalize(text).match(/[\p{L}\p{N}]+/gu) || [];
}
function topicScore(tokens: string[], topics: readonly string[]) {
  return topics.filter((stem) => tokens.some((token) => token.startsWith(stem))).length;
}
function isNamed(tokens: string[], aliases: readonly string[]) {
  return aliases.some((alias) =>
    tokens.some((token) =>
      // Short first names must be whole words: «Ада» must not match «адаптация».
      alias.length <= 4
        ? token === alias
        : token === alias ||
          (token.startsWith(alias) &&
            /^(а|у|ом|е|ы|ов|и|ию|ия|ем|ой)$/.test(token.slice(alias.length))),
    ),
  );
}

/** One director per room. No model call is spent deciding who should speak. */
export class CouncilDirector {
  private turn = 0;
  private lastSpoken = new Map<string, number>();
  private previous: string[] = [];

  reset() {
    this.turn = 0;
    this.lastSpoken.clear();
    this.previous = [];
  }

  select(text: string, problem = ""): CouncilPlan {
    this.turn++;
    const tokens = words(text);
    const normalized = normalize(text);
    const named = cast.filter((person) => isNamed(tokens, person.aliases));
    if (named.length) return { speakers: named.map((p) => p.id), reason: "named" };

    if (
      /остальн|кто.{0,20}(молч|не\s+(?:говор|отвеч|выступ))|молчавш|другая половина/.test(
        normalized,
      )
    ) {
      const others = cast.filter((person) => !this.previous.includes(person.id));
      if (others.length && this.previous.length)
        return { speakers: others.map((p) => p.id), reason: "others" };
    }
    if (/каждый из вас|пусть все|все шестеро|всех шестер|все по очереди/.test(normalized))
      return { speakers: cast.map((p) => p.id), reason: "everyone" };

    const isFollowup =
      /^(?:а\s+)?(?:поясни|объясни|уточни|продолжи|подробнее|почему\b|что именно)/.test(
        normalized.trim(),
      );
    if (isFollowup && this.previous.length)
      return { speakers: [this.previous[this.previous.length - 1]], reason: "followup" };

    const problemTokens = words(problem);
    const ranked = cast.map((person, index) => {
      const relevance =
        topicScore(tokens, person.topics) * 3 + topicScore(problemTokens, person.topics);
      const spoke = this.lastSpoken.get(person.id);
      const freshness = spoke == null ? 4 : Math.min(4, this.turn - spoke);
      return {
        id: person.id,
        relevance,
        lastTurn: spoke ?? -1,
        score: relevance + freshness - (this.previous.includes(person.id) ? 5 : 0),
        index,
      };
    });
    ranked.sort(
      (a, b) => b.score - a.score || a.lastTurn - b.lastTurn || a.index - b.index,
    );
    const topical = ranked.filter((p) => p.relevance > 0).length;
    const wantsComparison =
      /сравн|возраж|не соглас|мнения|вариант|риски|обсуд|справедлив|договор/.test(
        normalized,
      );
    const count = wantsComparison ? 3 : Math.max(1, Math.min(3, topical));
    return { speakers: ranked.slice(0, count).map((p) => p.id), reason: "topic" };
  }

  /** Record actual answers, not people who declined or whose model call failed. */
  finish(spoken: string[]) {
    if (!spoken.length) return;
    this.previous = [...new Set(spoken)];
    for (const id of this.previous) this.lastSpoken.set(id, this.turn);
  }
}

/** Deliberately conservative: catches textual repetition, not semantic agreement. */
export function repeatsReply(candidate: string, previous: string[]) {
  const tokens = words(candidate);
  if (tokens.length < 7)
    return previous.some((s) => normalize(s).trim() === normalize(candidate).trim());
  function triples(items: string[]) {
    return new Set(items.slice(2).map((_, i) => items.slice(i, i + 3).join(" ")));
  }
  const a = triples(tokens);
  return previous.some((reply) => {
    const b = triples(words(reply));
    const intersection = [...a].filter((item) => b.has(item)).length;
    const union = a.size + b.size - intersection;
    return union > 0 && intersection / union >= 0.78;
  });
}

export function isAbstention(text: string) {
  return /^[\s\[\]().!<>]*воздерж[а-яё]*[\s\[\]().!<>]*$/iu.test(text);
}

/** Keep the new part when a model prefixes it with already spoken sentences. */
export function removeEchoedSentences(candidate: string, previous: string[]) {
  const segmenter = new Intl.Segmenter("ru", { granularity: "sentence" });
  const earlier = previous.flatMap((reply) =>
    [...segmenter.segment(reply)].map((s) => s.segment.trim()),
  );
  return [...segmenter.segment(candidate)]
    .map((part) => part.segment.trim())
    .filter(
      (sentence) =>
        words(sentence).length < 6 ||
        !earlier.some((old) => repeatsReply(sentence, [old])),
    )
    .join(" ");
}
