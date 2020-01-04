import Paths from '../../src/resource/paths';

describe('Path', () => {
  describe('Trasforms', () => {
    test('Moves an identical index forwards', () => {
      const subject = 'a.0.b';
      const transformer = 'a.0.c';
      expect(Paths.transformPath(subject, transformer)).toBe('a.1.b');
    });

    test('Moves an earlier index forwards', () => {
      const subject = 'a.1.b';
      const transforer = 'a.0.b';
      expect(Paths.transformPath(subject, transforer)).toBe('a.2.b');
    });

    test('Moves an idential index backwards', () => {
      const subject = 'a.1.b';
      const transformer = 'a.1.c';
      expect(Paths.transformPath(subject, transformer, -1)).toBe('a.0.b');
    });
  });

  describe('Equality', () => {
    test('Marks idential paths as equal', () => {
      expect(Paths.areEqual('a.b.0.1', 'a.b.0.1')).toBe(true);
    });

    test('Marks different paths as unequal', () => {
      expect(Paths.areEqual('a.b.0.1', 'a.c.0.1')).toBe(false);
    });
  });

  describe('Selectors', () => {
    describe('Parent', () => {
      test('Gets the direct parent', () => {
        expect(Paths.parent('a.b')).toBe('a');
      });
      test(`Gets the direct nested parent`, () => {
        expect(Paths.parent('a.b.c')).toBe('a.b');
      });
      test(`Gets the correct granparent`, () => {
        expect(Paths.parent('a.b.c', 2)).toBe('a');
      });
      test('Returns the original path', () => {
        expect(Paths.parent('a.b', 0)).toBe('a.b');
      });
    });
  });

  describe('Matchers', () => {
    test('Marks the path as an ancestor', () => {
      expect(Paths.isDescendant('a.b.c', 'a.b')).toBe(true);
    });
    test('Marks the path as not an ancestor', () => {
      expect(Paths.isDescendant('a.b.c', 'a.d')).toBe(false);
    });
    test('Marks identical path as not an ancestor', () => {
      expect(Paths.isDescendant('a.b.c', 'a.b.c')).toBe(false);
    });
  });
});
