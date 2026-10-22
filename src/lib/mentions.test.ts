import { activeMentionQuery, insertMention, splitMentions } from './mentions';

describe('splitMentions', () => {
  it('splits mentions out of text', () => {
    expect(splitMentions('with @Bob_99, and @carol!')).toEqual([
      { text: 'with ' },
      { text: '@Bob_99', username: 'bob_99' },
      { text: ', and ' },
      { text: '@carol', username: 'carol' },
      { text: '!' },
    ]);
  });

  it('handles a mention at the start and adjacent mentions', () => {
    expect(splitMentions('@a @b')).toEqual([
      { text: '@a', username: 'a' },
      { text: ' ' },
      { text: '@b', username: 'b' },
    ]);
  });

  it('ignores emails and bare @', () => {
    expect(splitMentions('mail x@carol.com or @ alone')).toEqual([{ text: 'mail x@carol.com or @ alone' }]);
  });

  it('returns plain text unchanged', () => {
    expect(splitMentions('no mentions')).toEqual([{ text: 'no mentions' }]);
    expect(splitMentions('')).toEqual([]);
  });
});

describe('activeMentionQuery', () => {
  it('finds the mention being typed at the cursor', () => {
    expect(activeMentionQuery('hi @ca', 6)).toEqual({ query: 'ca', start: 3 });
    expect(activeMentionQuery('@', 1)).toEqual({ query: '', start: 0 });
  });

  it('returns null outside a mention', () => {
    expect(activeMentionQuery('hi @carol done', 14)).toBeNull();
    expect(activeMentionQuery('x@ca', 4)).toBeNull();
  });

  it('only looks before the cursor', () => {
    expect(activeMentionQuery('@ca and more', 3)).toEqual({ query: 'ca', start: 0 });
  });
});

describe('insertMention', () => {
  it('completes the mention and adds a space', () => {
    expect(insertMention('hi @ca', 3, 6, 'carol')).toBe('hi @carol ');
  });

  it('replaces the rest of a partially typed word and keeps following text', () => {
    expect(insertMention('@caxx and more', 0, 3, 'carol')).toBe('@carol and more');
  });
});
