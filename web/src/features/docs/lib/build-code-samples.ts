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
import { buildWebSocketSamples } from './build-websocket-samples'
import { getEndpointUrl } from './endpoint-utils'
import type { ApiEndpoint } from './types'

export type CodeSample = {
  language: string
  code: string
}

function buildMultipartSamples(
  endpoint: ApiEndpoint,
  apiBaseUrl: string
): CodeSample[] {
  const url = getEndpointUrl(endpoint, apiBaseUrl)
  const fields = endpoint.formFields ?? []
  const curlFields = fields.map((field) => `  -F "${field.name}=${field.type}"`)
  const jsFormFields = fields
    .map((field) =>
      field.type.startsWith('@')
        ? `form.append("${field.name}", await openAsBlob("${field.type.slice(1)}"), "${field.type.slice(1)}")`
        : `form.append("${field.name}", "${field.type}")`
    )
    .join('\n')
  const pythonFields = fields
    .filter((field) => !field.type.startsWith('@'))
    .map((field) => `    "${field.name}": "${field.type}",`)
    .join('\n')
  const fileField = fields.find((field) => field.type.startsWith('@'))
  const fileName = fileField?.type.replace('@', '') ?? 'file.bin'
  const fileParam = fileField?.name ?? 'file'
  return [
    {
      language: 'cURL',
      code: [
        `curl -X ${endpoint.method} "${url}"`,
        '  -H "Authorization: Bearer $NEW_API_KEY"',
        ...curlFields,
      ].join(' \\\n'),
    },
    {
      language: 'JavaScript',
      code: `// Node.js 20+: the API key remains in the local environment.
import { openAsBlob } from "node:fs"

const form = new FormData()
${jsFormFields}

const response = await fetch("${url}", {
  method: "${endpoint.method}",
  headers: {
    Authorization: \`Bearer \${process.env.NEW_API_KEY}\`,
  },
  body: form,
})

if (!response.ok) throw new Error(\`\${response.status}: \${await response.text()}\`)
const data = await response.json()
console.log(data)`,
    },
    {
      language: 'Go',
      code: `var body bytes.Buffer
writer := multipart.NewWriter(&body)
${fields
  .filter((field) => !field.type.startsWith('@'))
  .map(
    (field) => `writer.WriteField("${field.name}", "${field.type}")
`
  )
  .join('\n')}
file, err := os.Open("${fileName}")
if err != nil { panic(err) }
defer file.Close()
fileWriter, err := writer.CreateFormFile("${fileParam}", "${fileName}")
if err != nil { panic(err) }
if _, err = io.Copy(fileWriter, file); err != nil { panic(err) }
if err = writer.Close(); err != nil { panic(err) }

req, _ := http.NewRequest("${endpoint.method}", "${url}", &body)
req.Header.Set("Authorization", "Bearer "+os.Getenv("NEW_API_KEY"))
req.Header.Set("Content-Type", writer.FormDataContentType())
resp, err := http.DefaultClient.Do(req)
if err != nil { panic(err) }
defer resp.Body.Close()
if resp.StatusCode >= 400 { panic(resp.Status) }
io.Copy(os.Stdout, resp.Body)`,
    },
    {
      language: 'Python',
      code: `import os
import requests

url = "${url}"
headers = {"Authorization": f"Bearer {os.environ['NEW_API_KEY']}"}
data = {
${pythonFields}
}
files = {"${fileParam}": open("${fileName}", "rb")}

response = requests.request("${endpoint.method}", url, headers=headers, data=data, files=files)
response.raise_for_status()
print(response.json())`,
    },
    {
      language: 'Java',
      code: `// Imports: java.net.URI, java.net.http.*, java.nio.file.*, java.nio.charset.StandardCharsets, java.util.*
String boundary = "----NewApi" + UUID.randomUUID();
List<byte[]> parts = new ArrayList<>();
${fields
  .filter((field) => !field.type.startsWith('@'))
  .map(
    (field) =>
      `parts.add(("--" + boundary + "\\r\\nContent-Disposition: form-data; name=\\"${field.name}\\"\\r\\n\\r\\n${field.type}\\r\\n").getBytes(StandardCharsets.UTF_8));`
  )
  .join('\n')}
parts.add(("--" + boundary + "\\r\\nContent-Disposition: form-data; name=\\"${fileParam}\\"; filename=\\"${fileName}\\"\\r\\nContent-Type: application/octet-stream\\r\\n\\r\\n").getBytes(StandardCharsets.UTF_8));
parts.add(Files.readAllBytes(Path.of("${fileName}")));
parts.add(("\\r\\n--" + boundary + "--\\r\\n").getBytes(StandardCharsets.UTF_8));
HttpRequest request = HttpRequest.newBuilder()
  .uri(URI.create("${url}"))
  .header("Authorization", "Bearer " + System.getenv("NEW_API_KEY"))
  .header("Content-Type", "multipart/form-data; boundary=" + boundary)
  .method("${endpoint.method}", HttpRequest.BodyPublishers.ofByteArrays(parts))
  .build();
HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.statusCode());
System.out.println(response.body());`,
    },
    {
      language: 'C#',
      code: `using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization =
  new AuthenticationHeaderValue("Bearer", Environment.GetEnvironmentVariable("NEW_API_KEY"));

using var form = new MultipartFormDataContent();
${fields
  .filter((field) => !field.type.startsWith('@'))
  .map(
    (field) => `form.Add(new StringContent("${field.type}"), "${field.name}");
`
  )
  .join('\n')}
form.Add(new StreamContent(File.OpenRead("${fileName}")), "${fileParam}", "${fileName}");

using var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod("${endpoint.method}"), "${url}") { Content = form });
response.EnsureSuccessStatusCode();
Console.WriteLine(await response.Content.ReadAsStringAsync());`,
    },
  ]
}

export function buildCodeSamples(
  endpoint: ApiEndpoint,
  apiBaseUrl: string
): CodeSample[] {
  if (endpoint.transport === 'websocket') {
    return buildWebSocketSamples(getEndpointUrl(endpoint, apiBaseUrl))
  }
  if (endpoint.contentType === 'multipart/form-data') {
    return buildMultipartSamples(endpoint, apiBaseUrl)
  }
  const url = getEndpointUrl(endpoint, apiBaseUrl)
  const download = endpoint.downloadFileName
  const sampleBody = endpoint.sampleBody ?? '{}'
  const hasBody = endpoint.method !== 'GET' && endpoint.contentType !== 'none'
  const curlLines = [
    `curl ${download ? '--fail --show-error' : '--fail-with-body'} -X ${endpoint.method} "${url}"`,
    '  -H "Authorization: Bearer $NEW_API_KEY"',
  ]
  if (hasBody) {
    curlLines.push('  -H "Content-Type: application/json"')
    curlLines.push(`  -d '${sampleBody}'`)
  }
  if (download) curlLines.push(`  --output "${download}"`)
  const jsFetchOptions = hasBody
    ? `{
  method: "${endpoint.method}",
  headers: {
    Authorization: \`Bearer \${process.env.NEW_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${sampleBody}),
}`
    : `{
  method: "${endpoint.method}",
  headers: {
    Authorization: \`Bearer \${process.env.NEW_API_KEY}\`,
  },
}`
  const goRequest = hasBody
    ? `body := strings.NewReader(\`${sampleBody}\`)
req, _ := http.NewRequest("${endpoint.method}", "${url}", body)
req.Header.Set("Content-Type", "application/json")`
    : `req, _ := http.NewRequest("${endpoint.method}", "${url}", nil)`
  const pythonRequest = hasBody
    ? `payload = json.loads(r'''${sampleBody}''')
response = requests.request("${endpoint.method}", url, headers=headers, json=payload)`
    : `response = requests.request("${endpoint.method}", url, headers=headers)`
  const javaMethod = hasBody
    ? `.method("${endpoint.method}", HttpRequest.BodyPublishers.ofString("""
${sampleBody}
"""))`
    : `.method("${endpoint.method}", HttpRequest.BodyPublishers.noBody())`
  const csharpRequest = hasBody
    ? `var json = """
${sampleBody}
""";
using var content = new StringContent(json, Encoding.UTF8, "application/json");
using var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod("${endpoint.method}"), "${url}") { Content = content });`
    : `using var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod("${endpoint.method}"), "${url}"));`
  return [
    { language: 'cURL', code: curlLines.join(' \\\n') },
    {
      language: 'JavaScript',
      code: `const response = await fetch("${url}", ${jsFetchOptions})

if (!response.ok) throw new Error(\`\${response.status}: \${await response.text()}\`)
const data = ${download ? 'new Uint8Array(await response.arrayBuffer())' : 'await response.json()'}
console.log(data)`,
    },
    {
      language: 'Go',
      code: `${goRequest}
req.Header.Set("Authorization", "Bearer "+os.Getenv("NEW_API_KEY"))

resp, err := http.DefaultClient.Do(req)
if err != nil {
  panic(err)
}
defer resp.Body.Close()
if resp.StatusCode >= 400 { panic(resp.Status) }
${
  download
    ? `file, err := os.Create("${download}")
if err != nil { panic(err) }
defer file.Close()
if _, err = io.Copy(file, resp.Body); err != nil { panic(err) }`
    : 'io.Copy(os.Stdout, resp.Body)'
}`,
    },
    {
      language: 'Python',
      code: `import json
import os
import requests

url = "${url}"
headers = {"Authorization": f"Bearer {os.environ['NEW_API_KEY']}"}
${pythonRequest}
response.raise_for_status()
${
  download
    ? `with open("${download}", "wb") as output:
    output.write(response.content)`
    : 'print(response.json())'
}`,
    },
    {
      language: 'Java',
      code: `HttpRequest request = HttpRequest.newBuilder()
  .uri(URI.create("${url}"))
  .header("Authorization", "Bearer " + System.getenv("NEW_API_KEY"))
  ${hasBody ? '.header("Content-Type", "application/json")' : ''}
  ${javaMethod}
  .build();

${
  download
    ? `HttpResponse<byte[]> response = HttpClient.newHttpClient()
  .send(request, HttpResponse.BodyHandlers.ofByteArray());
if (response.statusCode() >= 400) throw new RuntimeException("HTTP " + response.statusCode());
Files.write(Path.of("${download}"), response.body());`
    : `HttpResponse<String> response = HttpClient.newHttpClient()
  .send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`
}`,
    },
    {
      language: 'C#',
      code: `using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization =
  new AuthenticationHeaderValue("Bearer", Environment.GetEnvironmentVariable("NEW_API_KEY"));

${csharpRequest}
response.EnsureSuccessStatusCode();
${download ? `await File.WriteAllBytesAsync("${download}", await response.Content.ReadAsByteArrayAsync());` : 'Console.WriteLine(await response.Content.ReadAsStringAsync());'}`,
    },
  ]
}
