import { describe, expect, it } from 'vitest';
import {
  resolvePortalEntry,
  vibepollReturnUrl,
  viberetroReturnUrl,
  vibestandupReturnUrl,
} from './portal-entry';

const standup = { toolKey: 'vibestandup', enabled: true };
const poll = { toolKey: 'vibepoll', enabled: true };
const retro = { toolKey: 'viberetro', enabled: true };
const slack = { toolKey: 'addons.slack', enabled: true };

describe('resolvePortalEntry', () => {
  it('stays when there are no workspaces', () => {
    expect(resolvePortalEntry([])).toEqual({ kind: 'stay' });
  });

  it('stays when there is more than one workspace', () => {
    expect(
      resolvePortalEntry([
        { id: 'ws1', tools: [standup] },
        { id: 'ws2', tools: [standup] },
      ]),
    ).toEqual({ kind: 'stay' });
  });

  it('stays when the only workspace does not include vibestandup', () => {
    expect(
      resolvePortalEntry([
        {
          id: 'ws1',
          tools: [slack, { toolKey: 'vibestandup', enabled: false }],
        },
      ]),
    ).toEqual({ kind: 'stay' });
  });

  it('opens vibestandup when it is the only enabled product', () => {
    expect(
      resolvePortalEntry([{ id: 'ws1', tools: [slack, standup] }]),
    ).toEqual({ kind: 'vibestandup', workspaceId: 'ws1' });
  });

  it('stays when multiple product tools are enabled', () => {
    expect(
      resolvePortalEntry([{ id: 'ws1', tools: [standup, poll, retro] }]),
    ).toEqual({ kind: 'stay' });
  });
});

describe('vibestandupReturnUrl', () => {
  it('includes enter and the workspace id', () => {
    expect(vibestandupReturnUrl('ws1')).toBe('/app?enter=1&workspaceId=ws1');
  });

  it('omits a blank workspace id', () => {
    expect(vibestandupReturnUrl('  ')).toBe('/app?enter=1');
  });
});

describe('vibepollReturnUrl', () => {
  it('includes enter and the workspace id', () => {
    expect(vibepollReturnUrl('ws1')).toBe('/app?enter=1&workspaceId=ws1');
  });
});

describe('viberetroReturnUrl', () => {
  it('includes enter and the workspace id', () => {
    expect(viberetroReturnUrl('ws1')).toBe('/app?enter=1&workspaceId=ws1');
  });
});
