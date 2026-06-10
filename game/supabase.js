import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(
  'https://evkmyctxsveaqflssbcf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2a215Y3R4c3ZlYXFmbHNzYmNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NjgyMjAsImV4cCI6MjA5NjA0NDIyMH0.itaHo1qHH9GfUz5nDUk9ZizukJinNAd3LL_9TruWvyw'
);

export const SESSION_ID = 'main';
