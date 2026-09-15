import { test } from "node:test";
import assert from "node:assert/strict";
import { sendNtfyNotification } from "../src/notify.js";

const ntfyConfig = { server: "https://ntfy.example.com", topic: "my-topic" };

function mockFetch(t, { ok = true, status = 200, statusText = "OK", responseBody = "" } = {}) {
  return t.mock.method(globalThis, "fetch", async (url, options) => {
    mockFetch.lastCall = { url, options };
    return {
      ok,
      status,
      statusText,
      text: async () => responseBody,
    };
  });
}

test("posts to `${server}/${topic}` with title header and message body", async (t) => {
  mockFetch(t);

  await sendNtfyNotification(ntfyConfig, { title: "New hit", message: "1999 BMW 328i" });

  const { url, options } = mockFetch.lastCall;
  assert.equal(url, "https://ntfy.example.com/my-topic");
  assert.equal(options.method, "POST");
  assert.equal(options.headers.Title, "New hit");
  assert.equal(options.body, "1999 BMW 328i");
});

test("includes Click header when a url is given, omits it otherwise", async (t) => {
  mockFetch(t);
  await sendNtfyNotification(ntfyConfig, { title: "t", message: "m", url: "https://row52.com/x" });
  assert.equal(mockFetch.lastCall.options.headers.Click, "https://row52.com/x");

  mockFetch(t);
  await sendNtfyNotification(ntfyConfig, { title: "t", message: "m" });
  assert.equal("Click" in mockFetch.lastCall.options.headers, false);
});

test("joins tags with commas into the Tags header", async (t) => {
  mockFetch(t);
  await sendNtfyNotification(ntfyConfig, { title: "t", message: "m", tags: ["car", "mag"] });
  assert.equal(mockFetch.lastCall.options.headers.Tags, "car,mag");
});

test("includes an Actions header with a Get Directions button when directionsUrl is given, omits it otherwise", async (t) => {
  mockFetch(t);
  await sendNtfyNotification(ntfyConfig, { title: "t", message: "m", directionsUrl: "https://maps.example.com/x" });
  assert.equal(mockFetch.lastCall.options.headers.Actions, "view, Get Directions, https://maps.example.com/x");

  mockFetch(t);
  await sendNtfyNotification(ntfyConfig, { title: "t", message: "m" });
  assert.equal("Actions" in mockFetch.lastCall.options.headers, false);
});

test("includes Attach header when imageUrl is given, omits it otherwise", async (t) => {
  mockFetch(t);
  await sendNtfyNotification(ntfyConfig, { title: "t", message: "m", imageUrl: "https://cdn.row52.com/x.jpg" });
  assert.equal(mockFetch.lastCall.options.headers.Attach, "https://cdn.row52.com/x.jpg");

  mockFetch(t);
  await sendNtfyNotification(ntfyConfig, { title: "t", message: "m" });
  assert.equal("Attach" in mockFetch.lastCall.options.headers, false);
});

test("includes Priority header when given, omits it otherwise", async (t) => {
  mockFetch(t);
  await sendNtfyNotification(ntfyConfig, { title: "t", message: "m", priority: "high" });
  assert.equal(mockFetch.lastCall.options.headers.Priority, "high");

  mockFetch(t);
  await sendNtfyNotification(ntfyConfig, { title: "t", message: "m" });
  assert.equal("Priority" in mockFetch.lastCall.options.headers, false);
});

test("throws with status info when ntfy responds with a non-ok status", async (t) => {
  mockFetch(t, { ok: false, status: 404, statusText: "Not Found", responseBody: "topic not found" });

  await assert.rejects(
    () => sendNtfyNotification(ntfyConfig, { title: "t", message: "m" }),
    /404.*Not Found.*topic not found/s,
  );
});
