export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
};

export const isValidBase64 = (str: string): boolean => {
  try {
    return btoa(atob(str)) === str;
  } catch {
    return false;
  }
};

export const sanitizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

export const encodeEmail = (email: string): string => {
  return Buffer.from(sanitizeEmail(email)).toString('base64');
};

export const decodeEmail = (encodedEmail: string): string => {
  try {
    return Buffer.from(encodedEmail, 'base64').toString('utf-8');
  } catch {
    throw new Error('Invalid encoded email');
  }
};

export const validateIdeaText = (text: string): { valid: boolean; error?: string } => {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Idea text cannot be empty' };
  }
  
  if (text.length > 5000) {
    return { valid: false, error: 'Idea text must be less than 5000 characters' };
  }
  
  return { valid: true };
};

export const validateTitle = (title: string): { valid: boolean; error?: string } => {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Title cannot be empty' };
  }
  
  if (title.length > 200) {
    return { valid: false, error: 'Title must be less than 200 characters' };
  }
  
  return { valid: true };
};
