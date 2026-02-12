export function assertEnv() {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'REPLACE_ME') {
    throw new Error('Missing OPENAI_API_KEY in environment');
  }
}

export const env = {
  get OPENAI_API_KEY() {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key === 'REPLACE_ME') {
      throw new Error('Missing OPENAI_API_KEY in environment');
    }
    return key;
  }
};
