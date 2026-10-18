/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { CodeSample } from './build-code-samples'

/** Realtime examples run in trusted clients where the API key stays private. */
export function buildWebSocketSamples(httpUrl: string): CodeSample[] {
  const socketUrl = new URL(httpUrl)
  socketUrl.protocol = socketUrl.protocol === 'http:' ? 'ws:' : 'wss:'
  const url = socketUrl.toString()
  return [
    {
      language: 'cURL',
      code: [
        '# Handshake diagnostic only; use a WebSocket client to exchange frames.',
        `curl --http1.1 --include --no-buffer "${httpUrl}" \\`,
        '  -H "Authorization: Bearer $NEW_API_KEY" \\',
        '  -H "Connection: Upgrade" \\',
        '  -H "Upgrade: websocket" \\',
        '  -H "Sec-WebSocket-Version: 13" \\',
        '  -H "Sec-WebSocket-Key: $(openssl rand -base64 16)"',
      ].join('\n'),
    },
    {
      language: 'JavaScript',
      code: `// Node.js: npm install ws
import WebSocket from "ws"

const socket = new WebSocket("${url}", {
  headers: { Authorization: \`Bearer \${process.env.NEW_API_KEY}\` },
})
socket.on("message", (message) => console.log(message.toString()))
socket.on("error", console.error)
// Send protocol events with socket.send(JSON.stringify(event)) after open.`,
    },
    {
      language: 'Python',
      code: `# pip install websockets
import os
from websockets.sync.client import connect

with connect("${url}", additional_headers={
    "Authorization": f"Bearer {os.environ['NEW_API_KEY']}"
}) as socket:
    for message in socket:
        print(message)
    # Send protocol events with socket.send(json.dumps(event)).`,
    },
    {
      language: 'Go',
      code: `// Imports: net/http, os, fmt, github.com/gorilla/websocket
headers := http.Header{"Authorization": {"Bearer " + os.Getenv("NEW_API_KEY")}}
conn, _, err := websocket.DefaultDialer.Dial("${url}", headers)
if err != nil { panic(err) }
defer conn.Close()
for {
    _, message, err := conn.ReadMessage()
    if err != nil { break }
    fmt.Println(string(message))
}
// Send protocol events with conn.WriteJSON(event).`,
    },
    {
      language: 'Java',
      code: `// Imports: java.net.URI, java.net.http.*, java.util.concurrent.CompletionStage
WebSocket socket = HttpClient.newHttpClient().newWebSocketBuilder()
  .header("Authorization", "Bearer " + System.getenv("NEW_API_KEY"))
  .buildAsync(URI.create("${url}"), new WebSocket.Listener() {
    public void onOpen(WebSocket socket) { socket.request(1); }
    public CompletionStage<?> onText(WebSocket socket, CharSequence text, boolean last) {
      System.out.print(text);
      socket.request(1);
      return null;
    }
  }).join();
// Send protocol events with socket.sendText(eventJson, true).
Thread.currentThread().join();`,
    },
    {
      language: 'C#',
      code: `// Imports: System.Net.WebSockets, System.Text
using var socket = new ClientWebSocket();
socket.Options.SetRequestHeader("Authorization", "Bearer " + Environment.GetEnvironmentVariable("NEW_API_KEY"));
await socket.ConnectAsync(new Uri("${url}"), CancellationToken.None);
var buffer = new byte[16384];
using var message = new MemoryStream();
while (socket.State == WebSocketState.Open) {
  var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
  if (result.MessageType == WebSocketMessageType.Close) break;
  message.Write(buffer, 0, result.Count);
  if (result.EndOfMessage) {
    Console.WriteLine(Encoding.UTF8.GetString(message.ToArray()));
    message.SetLength(0);
  }
}
// Send protocol events with socket.SendAsync.`,
    },
  ]
}
