export const VALID_USER = {
  userName: 'testuser',
  password: 'Test@123',
};

export const SAMPLE_BOOKS = {
  gitPocketGuide: {
    title: 'Git Pocket Guide',
    isbn: '9781449325862',
    author: 'Richard E. Silverman',
    publisher: "O'Reilly Media",
  },
  learningJsPatterns: {
    title: 'Learning JavaScript Design Patterns',
    isbn: '9781449331818',
    author: 'Addy Osmani',
    publisher: "O'Reilly Media",
  },
  youDontKnowJs: {
    title: "You Don't Know JS",
    isbn: '9781491904244',
    author: 'Kyle Simpson',
    publisher: "O'Reilly Media",
  },
};

export const EXPECTED_COLUMNS = ['Image', 'Title', 'Author', 'Publisher'];

export const TOTAL_BOOKS_COUNT = 8;

export function generateUniqueUserName(prefix = 'auto'): string {
  return `${prefix}_${Date.now()}`;
}
