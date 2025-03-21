import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn } from "child_process";
import { z } from "zod";
import axios from "axios";

const API_BASE_URL = "http://localhost:8888/api";

// Input schemas for the tools
const GlobSearchSchema = z.object({
  query: z.string()
});

const TypedGlobSearchSchema = z.object({
  query: z.string(),
  symbolType: z.enum(["package", "case class", "object", "function"])
});

const FQCNSchema = z.object({
  fqcn: z.string()
});

// Get project path from command line args
const projectPath = process.argv[2];
if (!projectPath) {
  console.error("Error: Project path must be provided as command line argument");
  process.exit(1);
} else {
  console.log(`Project path: ${projectPath}`);
}

// Create an MCP server
const server = new McpServer({
  name: "scala-mcp-server",
  version: "0.1.0"
});

// Add compile tool
server.tool("compile",
  {
    // No input parameters needed as we'll always run 'scala compile .'
  },
  async () => {
    return new Promise((resolve, reject) => {

      const scalaProcess = spawn('scala', ['compile', '.'], { cwd: projectPath });

      let stdout = '';
      let stderr = '';

      scalaProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      scalaProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      scalaProcess.on('close', (code) => {
        const output = 'stdout:\n' + stdout + (stderr ? 'stderr:\n' + stderr : '');
        resolve({
          content: [{
            type: "text",
            text: output
          }]
        });
      });

      scalaProcess.on('error', (err) => {
        reject(err);
      });
    });
  }
);

// Add test tool
server.tool("test",
  {
    // No input parameters needed as we'll always run 'scala compile .'
  },
  async () => {
    return new Promise((resolve, reject) => {
      const scalaProcess = spawn('scala', ['test', '.'], { cwd: projectPath });

      let stdout = '';
      let stderr = '';

      scalaProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      scalaProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      scalaProcess.on('close', (code) => {
        const output = stdout + (stderr ? '\nErrors:\n' + stderr : '');
        resolve({
          content: [{
            type: "text",
            text: output
          }]
        });
      });

      scalaProcess.on('error', (err) => {
        reject(err);
      });
    });
  }
);

// Add glob search tool
server.tool(
  "glob-search",
  GlobSearchSchema.shape,
  async (params, extra) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/glob-search`, {
        params: { query: params.query }
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API Error: ${error.response?.data || error.message}`);
      }
      throw error;
    }
  }
);

// Add typed glob search tool
server.tool(
  "typed-glob-search",
  TypedGlobSearchSchema.shape,
  async (params, extra) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/typed-glob-search`, {
        params: {
          query: params.query,
          symbolType: params.symbolType
        }
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API Error: ${error.response?.data || error.message}`);
      }
      throw error;
    }
  }
);

// Add inspect tool
server.tool(
  "inspect",
  FQCNSchema.shape,
  async (params, extra) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/inspect`, {
        params: { fqcn: params.fqcn }
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API Error: ${error.response?.data || error.message}`);
      }
      throw error;
    }
  }
);

// Add documentation retrieval tool
server.tool(
  "get-docs",
  FQCNSchema.shape,
  async (params, extra) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/docs`, {
        params: { fqcn: params.fqcn }
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API Error: ${error.response?.data || error.message}`);
      }
      throw error;
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
