import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import users from './data/users.json' with { type: 'json' };
import expensesJson from './data/expenses.json' with { type: 'json' };
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CreateMessageResultSchema } from '@modelcontextprotocol/sdk/types.js';

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
  mimeType: "application/json",
}, async (uri) => {
  const uriString = uri.toString();
  return {
    contents: [
      { uri: uriString, mimeType: "application/json", text: JSON.stringify(expensesJson) }
    ]
  };
});
server.registerResource("daily-total-expenses", new ResourceTemplate("expenses://daily-total/{month}/{day}", { list: undefined }), {
  title: "Daily Total Expenses",
  description: "A list of daily total expenses for a given month and day.",
  mimeType: "application/json",
}, async (uri, { month, day }) => {
  const monthString = Array.isArray(month) ? month[0] : month as string;
  const dayString = Array.isArray(day) ? day[0] : day as string;

  const uriString = uri.toString();
  const expenses = expensesJson as Record<string, { date: string; description: string; amount: number; }[]>;

  const dailyTotal = expenses[monthString.toLowerCase()]?.reduce((total: number, expense: { date: string; amount: number; }) => {
    if (parseInt(expense.date) === parseInt(dayString)) {
      return total + expense.amount;
    }
    return total;
  }, 0);
  return {
    contents: [
      { uri: uriString, mimeType: "application/json", text: JSON.stringify({ month, day, total: dailyTotal ?? 'No data for given date' }) }
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
server.registerTool("create-random-user", {
  title: "Create a random user with fake data",
  description: "Creates a new user with random fake data for testing purposes.",
  annotations: {
    title: "Create random User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true
  }
}, async () => {
  //send req to client 
  const result = await server.server.request(
    {
      method: "sampling/createMessage",
      params: {
        messages:
          [{
            role: "user",
            content: { type: "text", text: "Generate random user data including name, email, address, and phone number for testing purposes.Return the data in JSON format with no other text or formatting so that it can be used with JSON.parse. The generated user should have an ID, name, email, address, and phone number." }
          }], maxTokens: 1024
      }
    }, CreateMessageResultSchema);

  if (result.content.type !== "text") {
    return {
      content: [{ type: "text", text: "Failed to generate random user data." }]
    };
  }
  try {
    const userData = JSON.parse(result.content.text
      .trim()
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim());
    const id = await createUser(userData);
    return {
      content: [
        { type: "text", text: `User created successfully with ID: ${id}` }
      ]
    };
  } catch (e) {
    console.error("Error parsing user data:", e);
    return {
      content: [{ type: "text", text: "Failed to parse generated user data." }]
    };
  }
});

async function createUser(user: { name: string; email: string; address: string; phone: string; }) {
  const id = users.length + 1;
  users.push({ id, ...user });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const filePath = path.join(__dirname, 'data', 'users.json');

  await fs.writeFile(filePath, JSON.stringify(users, null, 2));
  return id;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main();