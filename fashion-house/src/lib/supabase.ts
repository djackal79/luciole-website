import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://arlwezgblzgktpqrorpj.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFybHdlemdibHpna3RwcXJvcnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMjU4ODMsImV4cCI6MjEwMTcwMTg4M30.A3QY8RKI8TpRmBPo_hKXX4B8wXgE0OevG7M_bh5O5-s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
