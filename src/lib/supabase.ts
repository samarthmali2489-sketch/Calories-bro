import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://trzufrveydzfqlllodcp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyenVmcnZleWR6ZnFsbGxvZGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNDMxODEsImV4cCI6MjA4ODYxOTE4MX0.WUz6iwKSiiQMQfYbB0c1A8XCTbbJrORNiNt0jSXJVxo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
