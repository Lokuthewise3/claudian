import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk/core';
import { z } from 'zod';

import { VAULT_TOOLS_SERVER_NAME } from './constants';
import { getBacklinks, type VaultGraphSource } from './vaultGraph';

export interface VaultToolsServer {
  readonly config: McpSdkServerConfigWithInstance;
  /** Fully qualified tool names; every tool is read-only, so they are safe to pre-approve. */
  readonly allowedTools: string[];
}

function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

/**
 * In-process MCP server over Obsidian's own index. Claudian owns it; it never touches the user's
 * native Claude MCP configuration. Create one per query: an MCP server serves a single transport.
 * Loaded lazily so zod and the MCP runtime stay out of plugin startup.
 */
export function createVaultToolsServer(source: VaultGraphSource): VaultToolsServer {
  const tools = [
    tool(
      'get_backlinks',
      'List the notes that link to a note, using Obsidian\'s resolved link index. '
        + 'Prefer this over searching file contents for "[[Note]]". Returns each linking note and its link count.',
      { note: z.string().describe('Vault-relative path (with or without .md) or note name') },
      async ({ note }) => {
        try {
          return textResult(getBacklinks(source, note));
        } catch (error) {
          return errorResult(error);
        }
      },
      { annotations: { readOnlyHint: true } },
    ),
  ];

  return {
    config: createSdkMcpServer({ name: VAULT_TOOLS_SERVER_NAME, tools }),
    allowedTools: tools.map(({ name }) => `mcp__${VAULT_TOOLS_SERVER_NAME}__${name}`),
  };
}
