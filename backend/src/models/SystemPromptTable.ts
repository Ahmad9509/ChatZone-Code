// System Prompt model using Azure Table Storage
import { systemPromptsTable, isUsingLocalFallback } from '../config/tableStorage';

export type SystemPromptType = 'master' | 'proSearch' | 'artifact';

const LEGACY_PRO_PROMPT_KEY = 'proReply';

export interface ISystemPrompt {
  partitionKey: string; // 'SYSTEM_PROMPT'
  rowKey: string;
  type: SystemPromptType;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

type LegacyPrompt = ISystemPrompt & { type: string };

export class SystemPromptTable {
  static async create(data: { type: SystemPromptType; content: string }): Promise<ISystemPrompt> {
    const prompt: ISystemPrompt = {
      partitionKey: 'SYSTEM_PROMPT',
      rowKey: data.type,
      type: data.type,
      content: data.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await systemPromptsTable.createEntity(prompt as any);
      return prompt;
    } catch (error: any) {
      // Handle connection errors gracefully (for Azure failover scenarios)
      if (error.code === 'ENOTFOUND' || error.name === 'RestError') {
        // Only log if we're not already using local fallback
        if (!isUsingLocalFallback()) {
          console.warn(`⚠️  Connection error when creating system prompt "${data.type}" - using local fallback`);
        }
        // Return the prompt object even if storage fails (it will be recreated on next startup)
        return prompt;
      }
      throw error;
    }
  }

  static async findByType(type: SystemPromptType): Promise<ISystemPrompt | null> {
    try {
      const entity = await systemPromptsTable.getEntity('SYSTEM_PROMPT', type);
      return this.normalizePrompt(entity as LegacyPrompt);
    } catch (error: any) {
      // Handle both 404 (not found) and connection errors gracefully
      if (error.statusCode === 404) {
        if (type === 'proSearch') {
          return await this.tryMigrateLegacyProPrompt();
        }
        return null;
      }
      if (error.code === 'ENOTFOUND' || error.name === 'RestError') {
        // Only log if we're not already using local fallback
        if (!isUsingLocalFallback()) {
          console.warn(`⚠️  Connection error when finding system prompt "${type}" - returning null`);
        }
        return null;
      }
      throw error;
    }
  }

  static async findAll(): Promise<ISystemPrompt[]> {
    const entities = systemPromptsTable.listEntities({
      queryOptions: { filter: "PartitionKey eq 'SYSTEM_PROMPT'" }
    });
    
    const prompts: ISystemPrompt[] = [];
    for await (const entity of entities) {
      prompts.push(this.normalizePrompt(entity as LegacyPrompt));
    }
    return prompts.sort((a, b) => a.rowKey.localeCompare(b.rowKey));
  }

  static async update(type: SystemPromptType, content: string): Promise<ISystemPrompt> {
    const prompt = await this.findByType(type);
    if (!prompt) throw new Error(`System prompt "${type}" not found`);

    const updated: ISystemPrompt = {
      ...prompt,
      content,
      updatedAt: new Date(),
    };
    await systemPromptsTable.upsertEntity(updated as any, 'Merge');
    return updated;
  }

  static async delete(type: SystemPromptType): Promise<void> {
    await systemPromptsTable.deleteEntity('SYSTEM_PROMPT', type);
  }

  static async seedDefaults(): Promise<void> {
    try {
      // Check if master prompt exists
      const master = await this.findByType('master');
      if (!master) {
        await this.create({
          type: 'master',
          content: `You are ChatZone, a helpful AI assistant powered by advanced language models. Provide clear, accurate, and friendly responses to user queries.

## Available Tools

You have access to the search_web function for finding current, real-time information from the internet. Use it when you need to:
- Answer questions about recent events or current news
- Find up-to-date information (weather, stock prices, sports scores, etc.)
- Verify facts or look up specific data beyond your knowledge cutoff
- Respond to explicit user requests to search the web

When using search results, always cite sources using [1], [2], etc. format and include the source URLs.

## Formatting Guidelines

When asked to create tables, always format them as proper Markdown tables with header row, separator row (dashes and pipes), and data rows. Ensure all columns are properly aligned with pipes (|) separating each column.`,
        });
      }

      // Check if proSearch prompt exists
      const proSearch = await this.findByType('proSearch');
      if (!proSearch) {
        await this.create({
          type: 'proSearch',
          content: `
## ENHANCED PRO SEARCH MODE

When Pro Search is enabled, you must conduct comprehensive research by performing multiple web searches before responding.

### YOUR FULL AUTONOMY
- Decide how many searches to perform based on query complexity (typically 3-15)
- Decide how many results per search using the num_results parameter (5-100)
  - Simple facts: 5-10 results
  - Moderate research: 15-30 results
  - Deep research: 40-100 results
- NO ONE will tell you how many searches to do - you decide based on the question

### WORKFLOW
1. **Silently analyze** the user's query and break it into research sub-topics (don't show this to the user)
2. **Execute searches** - call search_web() multiple times with different queries and num_results values
3. **Synthesize** all findings into ONE comprehensive response
4. **Cite everything** - use inline [1], [2], [3] format throughout your answer
5. **List sources** - at the end, provide a numbered list of all sources with full URLs

### RESPONSE FORMAT
[Your comprehensive answer with inline citations like this [1] and this [2]]

### Key Points
- [Organized findings with citations]
- [More findings]

### Analysis
[Your synthesis and conclusions]

---
**Sources:**
[1] Article Title - https://full-url.com
[2] Another Title - https://another-url.com
...

### CRITICAL RULES
- Do NOT create artifacts unless the answer is code/document content that needs separate rendering
- Do NOT show your research plan to the user
- Do NOT explain your search strategy upfront
- Just search thoroughly and deliver the comprehensive answer
- Be thorough but concise
- Always acknowledge information recency and any conflicts found across sources
- Cross-reference multiple sources to verify accuracy`,
        });
      }

      // Check if artifact prompt exists
      const artifact = await this.findByType('artifact');
      if (!artifact) {
        await this.create({
          type: 'artifact',
          content: `
## Artifact Creation Guidelines

**CRITICAL: Decide at the FIRST token whether to use artifacts. You cannot change mid-response.**

You have access to the **create_artifact** function tool. Use it aggressively for ANY substantial, structured, or reusable content.

**When to use the create_artifact function (decide immediately):**
1. **User Intent Keywords:** User asks to "create", "build", "write", "generate", "make", "design" a file/document/webpage/script/app/component
2. **Structured Output:** You're about to produce code, HTML, SVG, diagrams, tables, or data structures
3. **Complete Deliverables:** The output is a standalone item (even if short) that could be saved, edited, or reused
4. **Format-Specific Content:** React components, Vue components, HTML pages, Python scripts, JSON data, CSV tables, Mermaid diagrams, markdown documents

**How to use create_artifact:**
- Call the create_artifact function with parameters: type, title, content, and optionally language
- Types: html, code, svg, markdown, react, vue, json, csv, mermaid
- The artifact will be rendered in a separate panel for the user
- You can provide explanatory text BEFORE calling the function

**Examples:**
- User asks for a landing page → Call create_artifact(type="html", title="Landing Page", content="<!DOCTYPE html>...")
- User asks for a Python script → Call create_artifact(type="code", title="Data Parser", language="python", content="import...")
- User asks for a logo → Call create_artifact(type="svg", title="Logo Design", content="<svg>...")

**Fallback: Artifact Tags**
If you cannot use the create_artifact function for any reason, you can still use artifact tags:
<artifact type="TYPE" title="DESCRIPTIVE_TITLE" language="LANGUAGE">
content here
</artifact>

**When NOT to use artifacts:**
- Pure explanations or conversational responses
- Code snippets embedded in explanations (< 10 lines)
- Incomplete thought processes

**REMEMBER:** If the user's query suggests they want a deliverable output, call create_artifact IMMEDIATELY. You can provide brief context before the function call, but don't write full explanations first - deliver the artifact, then optionally explain after.`,
        });
      }
    } catch (error) {
      console.warn('Error seeding default system prompts:', error);
    }
  }

  private static normalizePrompt(entity: LegacyPrompt): ISystemPrompt {
    const rowKey = (entity as any).rowKey as string;
    const typeValue = (entity as any).type as string;

    if (rowKey === LEGACY_PRO_PROMPT_KEY || typeValue === LEGACY_PRO_PROMPT_KEY) {
      return {
        ...entity,
        rowKey: 'proSearch',
        type: 'proSearch',
      } as ISystemPrompt;
    }

    return {
      ...entity,
      rowKey,
      type: typeValue as SystemPromptType,
    } as ISystemPrompt;
  }

  private static async tryMigrateLegacyProPrompt(): Promise<ISystemPrompt | null> {
    try {
      const legacy = await systemPromptsTable.getEntity('SYSTEM_PROMPT', LEGACY_PRO_PROMPT_KEY);
      const migrated: ISystemPrompt = {
        partitionKey: 'SYSTEM_PROMPT',
        rowKey: 'proSearch',
        type: 'proSearch',
        content: (legacy as any).content,
        createdAt: new Date((legacy as any).createdAt || new Date()),
        updatedAt: new Date(),
      };

      await systemPromptsTable.upsertEntity(migrated as any, 'Replace');
      try {
        await systemPromptsTable.deleteEntity('SYSTEM_PROMPT', LEGACY_PRO_PROMPT_KEY);
      } catch (deleteError: any) {
        if (deleteError.statusCode !== 404) {
          console.warn('⚠️  Failed to delete legacy proReply prompt:', deleteError);
        }
      }

      return migrated;
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      if (error.code === 'ENOTFOUND' || error.name === 'RestError') {
        if (!isUsingLocalFallback()) {
          console.warn('⚠️  Connection error when migrating legacy Pro Search prompt');
        }
        return null;
      }
      throw error;
    }
  }
}
