import { CohortRule } from '../types';

const splitCSVLine = (line: string): string[] => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export const parseCohortCSV = (content: string): CohortRule[] => {
  const rules: CohortRule[] = [];
  const lines = content.split(/\r\n|\n|\r/);

  // Skip header if exists (heuristic: check for "course" or "degree")
  const startIndex = lines[0]?.toLowerCase().includes('course') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = splitCSVLine(line);
    
    // We need at least the Course Name and URL (2 columns)
    if (cols.length < 2) continue;

    const courseName = cols[0].replace(/^"|"$/g, '');
    const url = cols[1].replace(/^"|"$/g, '').trim();
    
    // Use optional chaining or defaults in case cols are missing/empty
    // Year is usually col 3, Degree is col 4 (0-indexed)
    const year = (cols[3] ? cols[3].replace(/^"|"$/g, '').trim() : ''); 
    const degree = (cols[4] ? cols[4].replace(/^"|"$/g, '').trim() : '');

    // Extract code from URL (name=code) if present
    // Example: https://.../view.php?name=catsproofsprocs_2025_2026
    const codeMatch = url.match(/name=([^&]+)/);
    const courseCode = codeMatch ? codeMatch[1] : '';

    // Push rule even if degree/year are missing, to ensure URL mapping works
    rules.push({
        courseName,
        courseCode,
        degree,
        year,
        url
    });
  }

  return rules;
};