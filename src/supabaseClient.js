'use strict';

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_KEY in environment variables. ' +
    'Copy .env.example to .env and fill in your Supabase project credentials.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Disable auto-refresh and session persistence on the server side
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

module.exports = supabase;
