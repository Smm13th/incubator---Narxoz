// Supabase client settings. Set these two values for your project.
const SUPABASE_URL = "https://njsoapahazipcmsgryqj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5abrWTFaFKuM8IG2tlT7_Q_WXL6amUa";
export const sb = window.supabase && SUPABASE_URL !== "YOUR_SUPABASE_URL"
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;
