import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import users from './data/users.json' with { type: 'json' };
import fs from 'node:fs/promises';

const server = new McpServer({
  name: 'My MCP Server',
  description: 'A simple MCP server example',
  version: '1.0.0',
});

server.registerTool("create-user", {
  title: "Create User",
  description: "Creates a new user with the given name and email.",
  inputSchema: {
    name: z.string(),
    email: z.string(),
    address: z.string(),
    phone: z.string(),
  },
  annotations: {
    title: "Create User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true
  }
}, async (params) => {
  try {
    const id = await createUser(params);
    return {
      content: [
        { type: "text", text: `User created successfully with ID: ${id}` }
      ]
    };
  } catch (e) {
    console.error("Error creating user:", e);
    return {
      content: [
        { type: "text", text: "An error occurred while creating the user." }
      ]
    };
  }
});


async function createUser(user: { name: string; email: string; address: string; phone: string; }) {
  const id = users.length + 1;
  users.push({ id, ...user });
  await fs.writeFile('./src/data/users.json', JSON.stringify(users, null, 2));
  return id;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main();