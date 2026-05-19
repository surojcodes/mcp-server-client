import 'dotenv/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { confirm, input, select } from '@inquirer/prompts';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Prompt, PromptMessage, Tool } from '@modelcontextprotocol/sdk/types.js';
import { generateText, ToolSet, jsonSchema } from 'ai';

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

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
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

      case "Resources":
        const resourceUri = await select({
          message: "Select a resource",
          choices: [
            ...resources.map(resource => ({
              name: resource.name,
              value: resource.uri,
              description: resource.description,
            })),
            ...resourceTemplates.map(template => ({
              name: template.name,
              value: template.uriTemplate,
              description: template.description,
            })),
          ],
        });
        const uri =
          resources.find(r => r.uri === resourceUri)?.uri ??
          resourceTemplates.find(r => r.uriTemplate === resourceUri)
            ?.uriTemplate;
        if (uri == null) {
          console.error("Resource not found.");
        } else {
          await handleResource(uri);
        }
        break;

      case "Prompts":
        const promptName = await select({
          message: "Select a prompt",
          choices: prompts.map(prompt => ({
            name: prompt.name,
            value: prompt.name,
            description: prompt.description,
          })),
        });
        const prompt = prompts.find(p => p.name === promptName);
        if (prompt == null) {
          console.error("Prompt not found.");
        } else {
          await handlePrompt(prompt);
        }
        break;

      case "Query":
        await handleQuery(tools);
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

async function handleResource(uri: string) {
  let finalUri = uri;
  // Check if the URI template has parameters (e.g., {param})
  const paramMatches = uri.match(/{([^}]+)}/g);
  // If the URI template has parameters, prompt the user to input values for them
  if (paramMatches != null) {
    for (const paramMatch of paramMatches) {
      const paramName = paramMatch.replace("{", "").replace("}", "");
      const paramValue = await input({
        message: `Enter value for ${paramName}:`,
      });
      finalUri = finalUri.replace(paramMatch, paramValue);
    }
  }
  const res = await mcpClient.readResource({ uri: finalUri });
  const value = "text" in res.contents[0] ? res.contents[0].text : res.contents[0].blob;
  console.log(
    JSON.stringify(JSON.parse(value), null, 2)
  );
}

async function handlePrompt(prompt: Prompt) {
  const args: Record<string, string> = {};
  for (const arg of prompt.arguments ?? []) {
    args[arg.name] = await input({
      message: `Enter value for ${arg.name}:`,
    });
  }

  const response = await mcpClient.getPrompt({
    name: prompt.name,
    arguments: args,
  });

  for (const message of response.messages) {
    console.log(await handleServerMessagePrompt(message));
  }
}

async function handleServerMessagePrompt(message: PromptMessage) {
  if (message.content.type !== "text") return;
  console.log(message.content.text);
  const run = await confirm({
    message: "Would you like to run the above prompt",
    default: true,
  });
  if (!run) return;
  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt: message.content.text,
  });
  return text;
}

async function handleQuery(tools: Tool[]) {
  const query = await input({ message: "Enter your query" });

  const { text, toolResults } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt: query,
  });

  console.log(
    // @ts-expect-error
    text || toolResults[0]?.result?.content[0]?.text || "No text generated."
  );
}

main();