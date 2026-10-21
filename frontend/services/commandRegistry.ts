/**
 * Unified Command Registry for Prism
 *
 * Represents all application actions as registered, typed commands:
 * - Powers searchable Command Palette (Ctrl+K / Cmd+K)
 * - Powers keyboard shortcuts
 * - Powers contextual toolbars & menus
 * - Powers AI Agent tool calls
 */

export interface CommandContext {
  activeView?: string;
  selectedPhotoIds?: (string | number)[];
  activeWorkspaceId?: string;
  isSafeMode?: boolean;
  [key: string]: any;
}

export interface Command {
  id: string;
  label: string;
  description?: string;
  category: 'Navigation' | 'Photos' | 'Editing' | 'Albums' | 'Video' | 'Workspaces' | 'System';
  icon?: string;
  shortcut?: string;
  destructive?: boolean;
  confirmationPrompt?: string;
  permission?: 'read' | 'write' | 'execute' | 'admin';
  keywords?: string[];
  isAvailable?: (context?: CommandContext) => boolean;
  execute: (params?: any, context?: CommandContext) => Promise<any> | any;
}

class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private listeners: Set<() => void> = new Set();

  public register(command: Command): () => void {
    this.commands.set(command.id, command);
    this.notify();
    return () => {
      this.commands.delete(command.id);
      this.notify();
    };
  }

  public registerBatch(cmds: Command[]): () => void {
    cmds.forEach((c) => this.commands.set(c.id, c));
    this.notify();
    return () => {
      cmds.forEach((c) => this.commands.delete(c.id));
      this.notify();
    };
  }

  public get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  public getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  public getAvailable(context?: CommandContext): Command[] {
    return this.getAll().filter((c) => !c.isAvailable || c.isAvailable(context));
  }

  public search(query: string, context?: CommandContext): Command[] {
    const q = query.toLowerCase().trim();
    const list = this.getAvailable(context);
    if (!q) return list;

    return list.filter((cmd) => {
      const matchLabel = cmd.label.toLowerCase().includes(q);
      const matchDesc = cmd.description?.toLowerCase().includes(q);
      const matchCat = cmd.category.toLowerCase().includes(q);
      const matchKeywords = cmd.keywords?.some((k) => k.toLowerCase().includes(q));
      const matchId = cmd.id.toLowerCase().includes(q);
      return matchLabel || matchDesc || matchCat || matchKeywords || matchId;
    });
  }

  public async execute(id: string, params?: any, context?: CommandContext): Promise<any> {
    const command = this.commands.get(id);
    if (!command) {
      throw new Error(`Command '${id}' not found in registry.`);
    }

    if (command.destructive && command.confirmationPrompt) {
      if (typeof window !== 'undefined' && !window.confirm(command.confirmationPrompt)) {
        return null;
      }
    }

    return await command.execute(params, context);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }
}

export const commandRegistry = new CommandRegistry();
