import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import users from './data/users.json' with { type: 'json' };
import expenses from './data/expenses.json' with { type: 'json' };
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
server.registerTool("get_github_repos", {
  title: "Get GitHub Repositories",
  description: "Fetches the public repositories of a GitHub user.",
  inputSchema: {
    username: z.string().describe("The GitHub username to fetch repositories for.")
  },
  annotations: {
    title: "Get GitHub Repositories",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  }
}, async ({ username }) => {
  const res = await fetch(`https://api.github.com/users/${username}/repos`, {
    headers: {
      'user-agent': 'MCP-Server'
    }
  });
  if (!res.ok) {
    return {
      content: [
        { type: "text", text: `Failed to fetch repositories for user: ${username}` }
      ]
    };
  }
  const repos = await res.json();
  const repoList = repos.map((repo: any, index: number) => `${index + 1}. ${repo.name}`).join('\n');
  return {
    content: [
      { type: "text", text: `Listing Repositories for user: ${username}` },
      { type: "text", text: repoList }
    ]
  };
});

server.registerResource("expenses", "expenses://all", {
  title: "All Expenses",
  description: "A list of all expenses.",
  mimeType: "text/plain",
}, async (uri) => {
  const uriString = uri.toString();
  return {
    contents: [
      { uri: uriString, mimeType: "text/plain", text: JSON.stringify(expenses) }
    ]
  };
});

server.registerPrompt("explain_sql_query", {
  title: "Explain SQL Query",
  description: "Explains the purpose and functionality of a given SQL query.",
  argsSchema: {
    query: z.string().describe("The SQL query to be explained.")
  },
}, async (params) => {
  const { query } = params;
  return {
    messages: [
      {
        role: "user", content: {
          type: "text",
          text: `Please explain the following SQL query:\n\n${query}. Give me a detailed explanation of what this query does, including the purpose of each clause and how it works together to produce the final result.`
        }
      },
    ]
  };
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