// In-memory live-tally hub: a tiny topic-based pub/sub used to push fresh survey
// results to presenters and audiences. Node uses this directly with `ws`. On
// Cloudflare the same shape is fronted by a Durable Object (see worker.ts).

export type LiveListener = (payload: unknown) => void;

export class LiveHub {
  private topics = new Map<string, Set<LiveListener>>();

  subscribe(topic: string, listener: LiveListener): () => void {
    let set = this.topics.get(topic);
    if (!set) {
      set = new Set();
      this.topics.set(topic, set);
    }
    set.add(listener);
    return () => this.unsubscribe(topic, listener);
  }

  unsubscribe(topic: string, listener: LiveListener): void {
    const set = this.topics.get(topic);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.topics.delete(topic);
  }

  publish(topic: string, payload: unknown): number {
    const set = this.topics.get(topic);
    if (!set) return 0;
    let delivered = 0;
    for (const listener of set) {
      try {
        listener(payload);
        delivered += 1;
      } catch {
        // a broken listener must never break the broadcast loop
      }
    }
    return delivered;
  }

  subscriberCount(topic: string): number {
    return this.topics.get(topic)?.size ?? 0;
  }
}

export function surveyTopic(surveyId: string): string {
  return `survey:${surveyId}`;
}

export const liveHub = new LiveHub();
