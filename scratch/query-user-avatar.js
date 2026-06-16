const { createClient } = require("@supabase/supabase-js");

const URL = "https://fipjjsbzrugqvobnwewm.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcGpqc2J6cnVncXZvYm53ZXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzA1NDYsImV4cCI6MjA5NjA0NjU0Nn0.mJOb_OmtsCbUKnZzQVQ_BqcaiWuKJsRkeFxqFZzwAdU";

const supabase = createClient(URL, ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, avatar_url, role");
  
  if (error) {
    console.error("Error fetching users:", error);
  } else {
    console.log("Users in DB:");
    data.forEach(u => {
      console.log(`- ID: ${u.id}, Email: ${u.email}, Name: ${u.full_name}, Avatar: ${u.avatar_url}`);
    });
  }
}

run();
