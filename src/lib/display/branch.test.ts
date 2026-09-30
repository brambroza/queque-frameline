import { describe, expect, it } from 'vitest';
import { ALL_BRANCHES, displayBranchKey, displayPath, displayQuery, pickDisplayBranch, type DisplayBranch } from './branch';

const HQ: DisplayBranch = { id: '30000000-0000-4000-8000-000000000001', code: 'HQ', name: 'คลังสำนักงานใหญ่' };
const BKK2: DisplayBranch = { id: '30000000-0000-4000-8000-000000000002', code: 'BKK2', name: 'คลังบางนา' };
const NO_CODE: DisplayBranch = { id: '30000000-0000-4000-8000-000000000003', code: null, name: 'คลังใหม่' };

describe('pickDisplayBranch', () => {
  it('shows the only branch when none is named', () => {
    expect(pickDisplayBranch([HQ], '')).toEqual({ kind: 'branch', branch: HQ });
    expect(pickDisplayBranch([HQ], null)).toEqual({ kind: 'branch', branch: HQ });
  });
  it('asks which branch when the site has several and none is named', () => {
    expect(pickDisplayBranch([HQ, BKK2], undefined)).toEqual({ kind: 'choose' });
    expect(pickDisplayBranch([HQ, BKK2], '   ')).toEqual({ kind: 'choose' });
  });
  it('falls back to the whole site when there is no branch at all', () => {
    expect(pickDisplayBranch([], '')).toEqual({ kind: 'all' });
  });
  it('matches a branch code case-insensitively', () => {
    expect(pickDisplayBranch([HQ, BKK2], 'bkk2')).toEqual({ kind: 'branch', branch: BKK2 });
    expect(pickDisplayBranch([HQ, BKK2], ' HQ ')).toEqual({ kind: 'branch', branch: HQ });
  });
  it('matches a branch id', () => {
    expect(pickDisplayBranch([HQ, NO_CODE], NO_CODE.id)).toEqual({ kind: 'branch', branch: NO_CODE });
  });
  it('shows every branch for "all"', () => {
    expect(pickDisplayBranch([HQ, BKK2], ALL_BRANCHES)).toEqual({ kind: 'all' });
    expect(pickDisplayBranch([HQ, BKK2], 'ALL')).toEqual({ kind: 'all' });
  });
  it('prefers a branch whose code is literally "all"', () => {
    const all: DisplayBranch = { id: 'x', code: 'ALL', name: 'All-in-one' };
    expect(pickDisplayBranch([HQ, all], 'all')).toEqual({ kind: 'branch', branch: all });
  });
  it('rejects an unknown branch instead of showing another one', () => {
    expect(pickDisplayBranch([HQ, BKK2], 'CNX')).toEqual({ kind: 'not_found' });
    expect(pickDisplayBranch([HQ], 'CNX')).toEqual({ kind: 'not_found' });
  });
});

describe('displayBranchKey', () => {
  it('uses the code, else the id', () => {
    expect(displayBranchKey(HQ)).toBe('HQ');
    expect(displayBranchKey(NO_CODE)).toBe(NO_CODE.id);
    expect(displayBranchKey({ id: 'abc', code: '  ' })).toBe('abc');
  });
});

describe('displayQuery', () => {
  it('is empty without a branch or a key', () => {
    expect(displayQuery('')).toBe('');
  });
  it('carries the branch and the key', () => {
    expect(displayQuery('all', 'k')).toBe('?branch=all&key=k');
  });
});

describe('displayPath', () => {
  it('builds the bare page', () => {
    expect(displayPath('')).toBe('/display');
  });
  it('adds the branch and the key', () => {
    expect(displayPath('HQ')).toBe('/display?branch=HQ');
    expect(displayPath('HQ', 's3cret')).toBe('/display?branch=HQ&key=s3cret');
    expect(displayPath('', 's3cret')).toBe('/display?key=s3cret');
  });
  it('escapes a code with spaces or Thai letters', () => {
    expect(displayPath('คลัง 1')).toBe(`/display?branch=${encodeURIComponent('คลัง 1')}`);
  });
});
