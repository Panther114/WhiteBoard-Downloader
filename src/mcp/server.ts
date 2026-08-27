import fs from 'fs';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { AgentService } from '../agent/service';
import { getConfig } from '../config';
import { getWorkflowLockStatus, WorkflowBusyError } from '../workflow/runLock';

function result(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }], structuredContent: value as Record<string, unknown> };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof WorkflowBusyError ? 'busy' : /credentials|required|login/i.test(message) ? 'authentication_required' : 'failed';
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, code, message }) }], isError: true };
}

export async function startMcpServer(): Promise<void> {
  const service = new AgentService();
  const server = new McpServer({ name: 'blackboardchina-downloader', version: '1.0.0' });

  server.registerTool('blackboard_status', {
    description: 'Return local Blackboard downloader readiness. This tool never contacts Blackboard or changes data.',
  }, async () => {
    try {
      return result({ ok: true, ...(await service.status()), lock: getWorkflowLockStatus() });
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('blackboard_list_courses', {
    description: 'Log in with locally stored credentials and list available Blackboard courses. Read-only.',
  }, async () => {
    try {
      return result({ ok: true, courses: await service.listCourses() });
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('blackboard_sync', {
    description: 'Read selected Blackboard course content, assignment details, announcements and optional allowed attachments. It never submits, grades, uploads, or changes Blackboard.',
    inputSchema: {
      course_ids: z.array(z.string()).optional().describe('Blackboard course IDs. Omit for all courses.'),
      include_files: z.boolean().optional().default(true),
      include_instructions: z.boolean().optional().default(true),
      output_dir: z.string().optional().describe('Optional export root; defaults to the configured download directory.'),
    },
  }, async ({ course_ids, include_files, include_instructions, output_dir }) => {
    try {
      return result({ ok: true, ...(await service.sync({ courseIds: course_ids, includeFiles: include_files, includeInstructions: include_instructions, outputDir: output_dir })) });
    } catch (error) {
      return errorResult(error);
    }
  });

  server.registerTool('blackboard_get_item', {
    description: 'Read one already-exported content item from the latest local agent manifest. Does not contact Blackboard.',
    inputSchema: { item_id: z.string() },
  }, async ({ item_id }) => {
    try {
      const manifestPath = path.join(getConfig().downloadDir, 'agent-export', 'manifest.json');
      if (!fs.existsSync(manifestPath)) return result({ ok: false, code: 'not_synced', message: 'No agent export exists. Run blackboard_sync first.' });
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { items?: Array<{ id: string }> };
      const item = manifest.items?.find(candidate => candidate.id === item_id);
      return item ? result({ ok: true, item, manifestPath }) : result({ ok: false, code: 'not_found', message: `No item with id ${item_id}` });
    } catch (error) {
      return errorResult(error);
    }
  });

  await server.connect(new StdioServerTransport());
  console.error('BlackboardChina Downloader MCP server ready on stdio.');
}

if (require.main === module) {
  void startMcpServer().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
