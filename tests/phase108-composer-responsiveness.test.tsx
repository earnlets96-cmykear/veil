import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('textarea resize scheduling', () => {
  it('does not synchronously measure the textarea in the input handler', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/MessageComposer.tsx'), 'utf8');
    const handler = source.match(/const handleTextChange = \(e: React\.ChangeEvent<HTMLTextAreaElement>\) => \{([\s\S]*?)\n  \};/);
    expect(handler).toBeTruthy();
    expect(handler?.[1]).not.toContain('scrollHeight');
  });

  it('uses the frame-coalesced resize hook for text and emoji edits', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/MessageComposer.tsx'), 'utf8');
    expect(source).toContain('useTextareaAutoResize');
    expect(source).not.toMatch(/setTimeout\(\(\) => \{[\s\S]{0,500}scrollHeight/);
  });

  it('keeps upload progress updates out of the message composer context', () => {
    const appState = fs.readFileSync(path.resolve(__dirname, '../src/ui/app/AppState.tsx'), 'utf8');
    expect(appState).toContain('ComposerContext.Provider');
    expect(appState).toContain('export function useComposer()');
    const valueStart = appState.indexOf('const composerValue =');
    const valueEnd = appState.indexOf('const value = React.useMemo<AppContextType>', valueStart);
    expect(valueStart).toBeGreaterThan(-1);
    expect(appState.slice(valueStart, valueEnd)).not.toContain('uploadProgress');
  });
});
