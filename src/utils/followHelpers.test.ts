import {
  classifyFollowInsertError,
  getFollowActions,
  statusForAction,
} from './followHelpers';

describe('getFollowActions', () => {
  it('follows public accounts directly, requesting as fallback', () => {
    expect(getFollowActions(false)).toEqual({ primary: 'follow', fallback: 'request' });
  });

  it('requests private accounts, following as fallback', () => {
    expect(getFollowActions(true)).toEqual({ primary: 'request', fallback: 'follow' });
  });
});

describe('statusForAction', () => {
  it('maps actions to resulting follow status', () => {
    expect(statusForAction('follow')).toBe('following');
    expect(statusForAction('request')).toBe('requested');
  });
});

describe('classifyFollowInsertError', () => {
  it('treats a duplicate row (double-tap) as already done', () => {
    expect(classifyFollowInsertError('23505')).toBe('already_done');
  });

  it('treats an RLS rejection as a privacy flip mid-flight', () => {
    expect(classifyFollowInsertError('42501')).toBe('privacy_flipped');
  });

  it('treats anything else as fatal', () => {
    expect(classifyFollowInsertError('23503')).toBe('fatal');
    expect(classifyFollowInsertError(undefined)).toBe('fatal');
    expect(classifyFollowInsertError(null)).toBe('fatal');
  });
});
