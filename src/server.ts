import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const server = new McpServer({
  name: 'My MCP Server',
  description: 'A simple MCP server example',
  version: '1.0.0',
})

async function main(){
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
main()