// A scripted stand-in for the Claude API (GET /v1/models and POST /v1/messages), so the live run is tested in
// the browser without a key and without spending anything. It streams realistic server-sent events: text
// for a structured answer, and for the Scout server_tool_use and web_search_tool_result blocks, a client
// tool_use for submit_signals, pause_turn and the usage with web_search_requests. Adapted from the
// Sovereignty Assessment 2.0.0 (tests/lib/fake-claude.mjs).
//
// Every request is checked against the rules the live run must follow (AC-08): the key and both headers,
// streaming, the preset's model, effort and thinking, the step's schema in output_config.format, one
// system prompt of a known agent, one user message (two turns only for the Scout), at most ten requests,
// and pause_turn sent again unchanged. Violations are collected for the test to report.
import { isDeepStrictEqual } from "node:util";
import { systemFor } from "../../js/prompts.js";
import { toWire } from "../../js/wire.js";
import { SCHEMAS, REQUESTS } from "../../schemas/swot.js";
import { MODELS } from "../../js/config.js";

export const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-expose-headers": "*" };
export const MODELS_LIST = { data: MODELS.map((m) => ({ id: m.id, type: "model", display_name: m.label, capabilities: { server_tools: { web_search: { supported: true } } } })), has_more: false };
const STEPS = ["complete", "research", "challenge", "assess", "strategise", "summary"];
const SYSTEMS = new Map(STEPS.map((s) => [systemFor(s), s]));

/** The step a request belongs to, by its system prompt. */
export const stepOf = (req) => SYSTEMS.get(req.system) || null;

export function sseFor({ id, model, blocks, stop, usage = {} }) {
  const ev = [];
  const push = (event, data) => ev.push(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  push("message_start", { type: "message_start", message: { id, type: "message", role: "assistant", model, content: [], stop_reason: null, usage: { input_tokens: usage.input_tokens ?? 2500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 } } });
  blocks.forEach((b, i) => {
    if (b.type === "text") {
      push("content_block_start", { type: "content_block_start", index: i, content_block: { type: "text", text: "" } });
      for (const piece of chunks(b.text, 97)) push("content_block_delta", { type: "content_block_delta", index: i, delta: { type: "text_delta", text: piece } });
    } else if (b.type === "thinking") {
      push("content_block_start", { type: "content_block_start", index: i, content_block: { type: "thinking", thinking: "", signature: "" } });
      push("content_block_delta", { type: "content_block_delta", index: i, delta: { type: "thinking_delta", thinking: b.thinking } });
      push("content_block_delta", { type: "content_block_delta", index: i, delta: { type: "signature_delta", signature: b.signature } });
    } else if (b.type === "tool_use" || b.type === "server_tool_use") {
      push("content_block_start", { type: "content_block_start", index: i, content_block: { type: b.type, id: b.id, name: b.name, input: {} } });
      for (const piece of chunks(JSON.stringify(b.input), 41)) push("content_block_delta", { type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: piece } });
    } else {
      push("content_block_start", { type: "content_block_start", index: i, content_block: b });
    }
    push("content_block_stop", { type: "content_block_stop", index: i });
  });
  push("message_delta", { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: usage.output_tokens ?? 1200, server_tool_use: { web_search_requests: usage.web_search_requests ?? 0 } } });
  push("message_stop", { type: "message_stop" });
  return ev.join("");
}

function chunks(s, n) {
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out.length ? out : [""];
}

/** What the run must send back after pause_turn: every block as the stream built it. */
function echoOf(blocks) {
  return blocks.map((b) => {
    if (b.type === "text") return { type: "text", text: b.text };
    if (b.type === "thinking") return { type: "thinking", thinking: b.thinking, signature: b.signature };
    if (b.type === "tool_use" || b.type === "server_tool_use") return { type: b.type, id: b.id, name: b.name, input: b.input };
    return b;
  });
}

// ---- block builders ---------------------------------------------------------------------------------------
let seq = 0;
const nid = (p) => `${p}_${String(++seq).padStart(4, "0")}`;
export const text = (t) => ({ type: "text", text: t });
export const json = (value) => text(JSON.stringify(value));
export const thinking = (t = "Weighing the items.") => ({ type: "thinking", thinking: t, signature: `sig-${"x".repeat(24)}` });
export const tool = (name, input) => ({ type: "tool_use", id: nid("toolu"), name, input });
/** A search and its results, as the server tool returns them. */
export function search(query, results) {
  const id = nid("srvtoolu");
  return [
    { type: "server_tool_use", id, name: "web_search", input: { query } },
    { type: "web_search_tool_result", tool_use_id: id, content: results.map((r) => ({ type: "web_search_result", url: r.url, title: r.title, encrypted_content: `enc:${Buffer.from(r.url).toString("base64")}`, page_age: r.page_age || "3 days ago" })) }
  ];
}
/** A search the turn asked for but the server deferred, because the turn also called a client tool. */
export function deferredSearch(query) {
  return [{ type: "server_tool_use", id: nid("srvtoolu"), name: "web_search", input: { query } }];
}
export function searchError(query, code = "unavailable") {
  const id = nid("srvtoolu");
  return [{ type: "server_tool_use", id, name: "web_search", input: { query } }, { type: "web_search_tool_result", tool_use_id: id, content: { type: "web_search_tool_result_error", error_code: code } }];
}

/**
 * The stand-in. script(n, req, step) returns the n-th response: { blocks, stop, usage } or { error: { status,
 * type, message, details, headers } } or { network: true }. expect: { model, effort, thinking } the
 * requests must carry ("thinking" is the field as sent, or undefined when it must be left out).
 */
export function createFakeClaude(script, { expect = null, key = null } = {}) {
  const violations = [];
  const requests = [];
  const sent = [];
  const check = (cond, msg) => { if (!cond) violations.push(`request ${requests.length}: ${msg}`); };

  function validate(req, headers, step) {
    check(!key || headers["x-api-key"] === key, "x-api-key is not the key the person entered");
    check(headers["anthropic-version"] === "2023-06-01", "anthropic-version is not 2023-06-01");
    check(headers["anthropic-dangerous-direct-browser-access"] === "true", "the direct browser access header is missing");
    check(req.stream === true, "stream must be true");
    check(!!step, `the system prompt is not one of the agents' (${String(req.system).slice(0, 40)})`);
    check(Array.isArray(req.messages) && req.messages[0]?.role === "user" && typeof req.messages[0].content === "string", "the first message is one user message with the run as JSON");
    check(Number.isInteger(req.max_tokens) && req.max_tokens > 0, "max_tokens is missing");
    check(requests.length <= 10, "an eleventh request");
    if (expect) {
      check(req.model === expect.model, `model ${req.model}, the setting says ${expect.model}`);
      check(req.output_config?.effort === expect.effort, `effort ${req.output_config?.effort}, the setting says ${expect.effort}`);
      check(isDeepStrictEqual(req.thinking, expect.thinking), `thinking ${JSON.stringify(req.thinking)}, the setting says ${JSON.stringify(expect.thinking)}`);
    }
    if (step && step !== "research") {
      check(req.messages.length === 1, `a ${step} request carries one message, not ${req.messages.length}`);
      check(req.output_config?.format?.type === "json_schema" && isDeepStrictEqual(req.output_config.format.schema, toWire(SCHEMAS[REQUESTS[step]], SCHEMAS)), `the ${step} request's output_config.format is not its schema`);
      check(!req.tools, `a ${step} request sends tools`);
    }
    if (step === "research") {
      check(req.tool_choice?.type === "auto", "the Scout's tool_choice is not auto");
      check(req.tools?.some((t) => t.type === "web_search_20250305" && t.max_uses === 5), "the Scout's web search is not five searches");
      check(req.tools?.some((t) => t.name === "submit_signals" && t.strict === true && isDeepStrictEqual(t.input_schema, toWire(SCHEMAS.Signals, SCHEMAS))), "submit_signals is not the strict tool with the Signals schema");
      check(!req.output_config?.format, "the Scout sends an output format");
      // pause_turn: the conversation comes back unchanged, the paused turn last.
      const prev = requests[requests.length - 2];
      if (prev?.stop === "pause_turn") {
        const before = prev.req.messages;
        check(req.messages.length === before.length + 1 && isDeepStrictEqual(req.messages.slice(0, before.length), before) && req.messages[req.messages.length - 1].role === "assistant" && isDeepStrictEqual(req.messages[req.messages.length - 1].content, prev.echo), "after pause_turn the conversation must come back unchanged");
      }
    }
  }

  return {
    violations, requests, sent,
    /** The response to one POST /v1/messages: { status, headers, body } or { abort: true }. */
    handle(raw, headers) {
      const req = JSON.parse(raw);
      const step = stepOf(req);
      const entry = { req, headers, step, stop: null, echo: null };
      requests.push(entry);
      validate(req, headers, step);
      const r = script(requests.length, req, step);
      if (!r) {
        violations.push(`request ${requests.length} (${step}): the script has no answer`);
        return { status: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "error", error: { type: "api_error", message: "script exhausted" } }) };
      }
      if (r.network) return { abort: true };
      if (r.error) {
        return { status: r.error.status, headers: { "content-type": "application/json", ...(r.error.headers || {}) }, body: JSON.stringify({ type: "error", error: { type: r.error.type, message: r.error.message, ...(r.error.details ? { details: r.error.details } : {}) }, request_id: `req_${requests.length}` }) };
      }
      entry.stop = r.stop;
      entry.echo = echoOf(r.blocks);
      sent.push(entry.echo);
      return { status: 200, headers: { "content-type": "text/event-stream", "request-id": `req_${requests.length}` }, body: sseFor({ id: `msg_${requests.length}`, model: req.model, blocks: r.blocks, stop: r.stop, usage: r.usage }) };
    }
  };
}

/** The tool_result blocks of a request's last user turn. */
export function toolResults(req) {
  const last = [...(req.messages || [])].reverse().find((m) => m.role === "user" && Array.isArray(m.content));
  return last ? last.content.filter((b) => b.type === "tool_result") : [];
}
