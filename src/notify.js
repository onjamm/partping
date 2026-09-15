// ntfy.sh publish API: https://docs.ntfy.sh/publish/
// POST to `${server}/${topic}` with the message as the body and metadata as headers.

export async function sendNtfyNotification(ntfyConfig, { title, message, url, tags, actions, imageUrl, priority, markdown }) {
  const { server, topic } = ntfyConfig;

  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    Title: title,
  };
  if (url) headers.Click = url; // tapping the notification opens the listing
  if (tags?.length) headers.Tags = tags.join(",");
  // extra tappable buttons, e.g. Get Directions / Check Options
  if (actions?.length) headers.Actions = actions.map((a) => `view, ${a.label}, ${a.url}`).join("; ");
  if (imageUrl) headers.Attach = imageUrl; // ntfy fetches this and attaches it to the push
  if (priority) headers.Priority = priority;
  if (markdown) headers.Markdown = "yes"; // lets **bold** etc. render in the message body

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
