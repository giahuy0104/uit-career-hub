export function parseServerSentEvent(block) {
  let event = "message";
  let id = "";
  const data = [];

  for (const line of block.split(/\r\n|\r|\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "id") id = value;
    else if (field === "data") data.push(value);
  }

  if (!data.length) return null;
  return { event, id, data: data.join("\n") };
}

function nextBoundary(buffer) {
  const match = /\r\n\r\n|\n\n|\r\r/.exec(buffer);
  if (!match) return null;
  return { index: match.index, length: match[0].length };
}

export async function consumeNotificationStream(response, onEvent) {
  if (!response.body) throw new Error("Trình duyệt không hỗ trợ luồng thông báo realtime.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let boundary = nextBoundary(buffer);
    while (boundary) {
      const message = parseServerSentEvent(buffer.slice(0, boundary.index));
      buffer = buffer.slice(boundary.index + boundary.length);
      if (message) onEvent(message);
      boundary = nextBoundary(buffer);
    }

    if (done) {
      const message = parseServerSentEvent(buffer);
      if (message) onEvent(message);
      return;
    }
  }
}
