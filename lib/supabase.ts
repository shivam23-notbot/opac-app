import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file (see .env.example).'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function fetchAll(table: string, options?: { select?: string, gte?: { column: string, value: any }, order?: { column: string, ascending: boolean } }): Promise<{ data: any[], error?: any }> {
  const allData: any[] = [];
  let from = 0;
  const step = 1000;
  const select = options?.select || '*';
  
  while (true) {
    let query = supabase.from(table).select(select);
    if (options?.gte) {
      query = query.gte(options.gte.column, options.gte.value);
    }
    if (options?.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending });
    }
    
    const { data, error } = await query.range(from, from + step - 1);
      
    if (error) {
      console.error(`[fetchAll] Error:`, error);
      return { data: allData, error };
    }
    
    if (!data || data.length === 0) break;
    
    allData.push(...data);
    
    if (data.length < step) break;
    from += step;
  }
  
  return { data: allData };
}
