/**
 * Global type declarations for Novel Workshop
 */

declare global {
  interface Window {
    __getCardExtension__?: (key: string) => unknown;
    __setCardExtension__?: (key: string, data: unknown) => void;
    __getWorldbookEntries__?: () => Array<{
      comment?: string;
      content?: string;
      keys?: string[];
      strategy?: string;
      position?: number;
      depth?: number;
      role?: number;
      order?: number;
      prob?: number;
      enabled?: boolean;
    }>;
    __setWorldbookEntries__?: (entries: Array<{
      comment?: string;
      content?: string;
      keys?: string[];
      strategy?: string;
      position?: number;
      depth?: number;
      role?: number;
      order?: number;
      prob?: number;
      enabled?: boolean;
    }>) => void;
    __applyExternalVariableDesign__?: (design: {
      source: string;
      message: string;
      design: {
        summary: string;
        variables: Array<{
          path: string;
          type: string;
          options?: string[];
          default?: unknown;
          description: string;
          check?: string[];
        }>;
      };
    }) => { count: number };
    __getCurrentDraftId__?: () => string;
  }
}

export {};
