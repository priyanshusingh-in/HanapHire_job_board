import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { runScreeningCompletion } from "./agent-llm-client";

const schema = z.object({ score: z.number() });

const baseEnv = {
  AI_PROVIDERS: "gemini,groq",
  GEMINI_API_KEYS: "gemini-key-1,gemini-key-2",
  GROQ_API_KEYS: "groq-key-1",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function chatCompletion(content: string) {
  return { choices: [{ message: { content } }] };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runScreeningCompletion", () => {
  it("returns validated data on first successful attempt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(chatCompletion(JSON.stringify({ score: 88 }))));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runScreeningCompletion({
      systemPrompt: "sys",
      userPrompt: "user",
      responseSchema: schema,
      env: baseEnv,
    });

    expect(result).toEqual({ score: 88 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("generativelanguage.googleapis.com");
  });

  it("fails over to the next key in the same provider on 429", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429))
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ score: 70 }))));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runScreeningCompletion({
      systemPrompt: "sys",
      userPrompt: "user",
      responseSchema: schema,
      env: baseEnv,
    });

    expect(result).toEqual({ score: 70 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Both calls hit gemini (2 keys) before any groq call would be needed.
    expect(fetchMock.mock.calls[0][0]).toContain("generativelanguage.googleapis.com");
    expect(fetchMock.mock.calls[1][0]).toContain("generativelanguage.googleapis.com");
  });

  it("fails over to the next provider once a provider's keys are exhausted", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401)) // gemini key 1
      .mockResolvedValueOnce(jsonResponse({ error: "server error" }, 500)) // gemini key 2
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ score: 55 })))); // groq key 1
    vi.stubGlobal("fetch", fetchMock);

    const result = await runScreeningCompletion({
      systemPrompt: "sys",
      userPrompt: "user",
      responseSchema: schema,
      env: baseEnv,
    });

    expect(result).toEqual({ score: 55 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain("api.groq.com");
  });

  it("retries the same key with a stricter prompt on malformed JSON, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(chatCompletion("not json at all")))
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ score: 92 }))));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runScreeningCompletion({
      systemPrompt: "sys",
      userPrompt: "user",
      responseSchema: schema,
      env: baseEnv,
    });

    expect(result).toEqual({ score: 92 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Retried the same provider (gemini), not failed over.
    expect(fetchMock.mock.calls[1][0]).toContain("generativelanguage.googleapis.com");
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.messages[1].content).toContain("was not valid JSON");
  });

  it("retries the same key when JSON is well-formed but fails schema validation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ score: "not-a-number" }))))
      .mockResolvedValueOnce(jsonResponse(chatCompletion(JSON.stringify({ score: 61 }))));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runScreeningCompletion({
      systemPrompt: "sys",
      userPrompt: "user",
      responseSchema: schema,
      env: baseEnv,
    });

    expect(result).toEqual({ score: 61 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.messages[1].content).toContain("did not match the required JSON shape");
  });

  it("throws once every configured (provider, key) pair is exhausted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "down" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runScreeningCompletion({
        systemPrompt: "sys",
        userPrompt: "user",
        responseSchema: schema,
        env: baseEnv,
      }),
    ).rejects.toThrow(/exhausted/);

    // 3 total keys configured (2 gemini + 1 groq) — all tried, capped by MAX_TOTAL_ATTEMPTS.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("never includes raw key material in thrown errors or logs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "down" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      runScreeningCompletion({
        systemPrompt: "sys",
        userPrompt: "user",
        responseSchema: schema,
        env: baseEnv,
      }),
    ).rejects.toThrow();

    const loggedText = warnSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(loggedText).not.toContain("gemini-key-1");
    expect(loggedText).not.toContain("groq-key-1");
    warnSpy.mockRestore();
  });
});
