import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const mcpClient = new Client({
  name: "text-client",
  description: "A client that can process text input and generate text output.",
  version: "1.1.0"
});

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/server.js"],
  stderr: "ignore"
});

async function main() {
  await mcpClient.connect(transport);
  const [{ tools }, { prompts }, { resources }, { resourceTemplates }] = await Promise.all([
    mcpClient.listTools(),
    mcpClient.listPrompts(),
    mcpClient.listResources(),
    mcpClient.listResourceTemplates()
  ]);
  console.log("Your are connected to the MCP server!");
}

main();