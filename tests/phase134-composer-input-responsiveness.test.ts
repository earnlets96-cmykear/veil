import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 134 composer input responsiveness', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/MessageComposer.tsx'), 'utf8');

  it('keeps the textarea value in the DOM instead of rerendering it as a controlled input', () => {
    expect(source).toContain('const textValueRef = useRef(\'\');');
    expect(source).toContain('textValueRef.current = e.currentTarget.value;');
    expect(source).not.toMatch(/<textarea[\s\S]{0,350}\bvalue=\{text\}/);
  });

  it('only updates React when text crosses the empty/non-empty boundary', () => {
    expect(source).toContain('const [hasText, setHasText] = useState(false);');
    expect(source).toContain('if (nextHasText !== hasTextRef.current)');
    expect(source).not.toContain('setText(e.target.value)');
  });

  it('reads the current textarea value from the ref when sending', () => {
    expect(source).toContain('const msgText = textValueRef.current.trim();');
    expect(source).toContain('updateComposerText(\'\');');
  });
});
