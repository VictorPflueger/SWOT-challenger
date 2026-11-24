// The Scout's rules (PLAN.md 3.1, brief 5.6, AC-12): research is optional and off by default. The Scout
// searches the web with the API's own search tool (five searches at most) and hands its signals in through
// the strict client tool submit_signals, which it calls by itself (tool_choice auto, because Sonnet 5.5
// refuses forced tool use). Code accepts a signal only when its URL is among the results of this Scout's
// own searches; every other URL is refused with is_error, once. A turn that pauses (pause_turn) is sent
// again unchanged. A turn that ends without submit_signals gets one reminder. At most three requests:
// the first, a resend after pause_turn, and one round after refused URLs or a search the tool call
// deferred. Pure functions: the pipeline (js/pipeline.js) sends the requests.

import { RESEARCH } from "./config.js";

/** Every URL the searches in these assistant contents returned. */
export function searchedUrls(contents) {
  const urls = new Set();
  for (const content of contents) {
    for (const block of content || []) {
      if (block?.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
      for (const r of block.content) if (r?.type === "web_search_result" && typeof r.url === "string") urls.add(r.url);
    }
  }
  return urls;
}

/** The searches of a turn that have no result yet: deferred because the turn also called a client tool. */
export function deferredSearches(content) {
  const done = new Set((content || []).filter((b) => b?.type === "web_search_tool_result").map((b) => b.tool_use_id));
  return (content || []).filter((b) => b?.type === "server_tool_use" && b.name === "web_search" && !done.has(b.id)).map((b) => b.id);
}

/** True when a search in these contents came back with an error instead of results. */
export function searchFailed(contents) {
  return contents.some((c) => (c || []).some((b) => b?.type === "web_search_tool_result" && b.content && !Array.isArray(b.content)));
}

/** The submit_signals calls of a turn. */
export const submissions = (content) => (content || []).filter((b) => b?.type === "tool_use" && b.name === "submit_signals");

/** Signals split by whether their URL came from the Scout's own searches. */
export function sortSignals(signals, urls) {
  const accepted = [];
  const refused = [];
  for (const s of signals || []) (urls.has(s.url) ? accepted : refused).push(s);
  return { accepted, refused };
}

/** The tool result that refuses URLs: is_error, with the URLs and what to do. */
export function refusalFor(toolUseId, refused) {
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    is_error: true,
    content: `These URLs are not among your search results in this conversation, so they were refused: ${refused.map((s) => s.url).join(", ")}. Call submit_signals again with only URLs your searches returned, or with an empty list.`
  };
}

/** The tool result that accepts a submission. */
export const acceptanceFor = (toolUseId, n) => ({ type: "tool_result", tool_use_id: toolUseId, content: `Received ${n} signal${n === 1 ? "" : "s"}. Thank you.` });

/** The reminder for a turn that ended without submit_signals. */
export const REMINDER = "Call submit_signals now with the signals you found, or with an empty list.";

/** The most requests one Scout may send. */
export const MAX_SCOUT_REQUESTS = RESEARCH.maxRequests;
