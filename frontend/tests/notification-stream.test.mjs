import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeNotificationStream,
  parseServerSentEvent,
} from "../src/notifications/notification-stream.js";

test("parseServerSentEvent parses a notification snapshot", () => {
  assert.deepEqual(
    parseServerSentEvent('id: cursor-2\nevent: notifications\ndata: {"unreadCount":2}'),
    {
      id: "cursor-2",
      event: "notifications",
      data: '{"unreadCount":2}',
    },
  );
  assert.equal(parseServerSentEvent(":keep-alive"), null);
});

test("consumeNotificationStream supports events split across chunks", async () => {
  const encoder = new TextEncoder();
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("id: cursor-3\nevent: notifi"));
      controller.enqueue(encoder.encode('cations\ndata: {"unreadCount":3}\n\n'));
      controller.close();
    },
  }));
  const events = [];

  await consumeNotificationStream(response, (event) => events.push(event));

  assert.deepEqual(events, [{
    id: "cursor-3",
    event: "notifications",
    data: '{"unreadCount":3}',
  }]);
});
