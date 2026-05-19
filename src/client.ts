import { input, select } from '@inquirer/prompts';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Tool } from '@modelcontextprotocol/sdk/types';

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
  while (true) {
    const option = await select({
      message: "What do you want to do?",
      choices: ["Query", "Tools", "Prompts", "Resources", "Resource Templates"]
    });
    switch (option) {
      case "Tools":
        const toolName = await select({
          message: "Which tool do you want to use?",
          choices: tools.map(tool => ({
            name: tool.annotations?.title || tool.name,
            value: tool.name,
            description: tool.description
          }))
        });
        console.log(`You selected tool: ${toolName}`);
        const tool = tools.find(t => t.name === toolName);
        if (tool == null) {
          console.error("Tool not found.");
        } else {
          await handleTool(tool);
        }
        break;


    }
  }
}

async function handleTool(tool: Tool) {
  const args: Record<string, string> = {};

  //get input for each argument defined in the tool's input schema
  for (const [key, value] of Object.entries(
    tool.inputSchema.properties ?? {}
  )) {
    args[key] = await input({
      message: `Enter value for ${key} (${(value as { type: string; }).type}):`,
    });
  }
  const res = await mcpClient.callTool({
    name: tool.name,
    arguments: args,
  });
  console.log((res.content as [{ text: string; }])[0].text);
}

main();