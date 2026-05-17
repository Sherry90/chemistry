// Phase 09 §6.8 (D10) — isTextInputTarget.
import { describe, it, expect } from 'vitest';
import { isTextInputTarget } from '@/viewport/interactions/textInputGuard';

describe('isTextInputTarget', () => {
  it('null / 비-HTMLElement → false', () => {
    expect(isTextInputTarget(null)).toBe(false);
  });

  it('<input> / <textarea> → true', () => {
    expect(isTextInputTarget(document.createElement('input'))).toBe(true);
    expect(isTextInputTarget(document.createElement('textarea'))).toBe(true);
  });

  it('[contenteditable=true] → true', () => {
    const d = document.createElement('div');
    d.setAttribute('contenteditable', 'true');
    // jsdom: isContentEditable 는 attribute 기반.
    Object.defineProperty(d, 'isContentEditable', { value: true });
    expect(isTextInputTarget(d)).toBe(true);
  });

  it('일반 <div> → false', () => {
    expect(isTextInputTarget(document.createElement('div'))).toBe(false);
  });
});
