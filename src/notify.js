// ntfy.sh publish API: https://docs.ntfy.sh/publish/
// POST to `${server}/${topic}` with the message as the body and metadata as headers.

export async function sendNtfyNotification(ntfyConfig, { title, message, url, tags }) {
  const { server, topic } = ntfyConfig;

  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    Title: title,
  };
  if (url) headers.Click = url;
  if (tags?.length) headers.Tags = tags.join(",");

  const res = await fetch(`${server}/${topic}`, {
    method: "POST",
    headers,
    body: message,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ntfy publish failed: ${res.status} ${res.statusText} ${body}`);
  }
}
