// Code adapted from Supabase (2025) Getting Started with Supabase JavaScript Client
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

console.log('SB URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SB KEY present:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);


// Defines what a row in the "test" table looks like
type TestRow = {
  id: number;
  name: string | null;
  created_at: string | null;
};

// Create client (use env vars in Vercel; .env.local in dev)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Default export: required by Next.js App Router
export default function SupabaseTestPage() {
  const [testData, setTestData] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all data from supabase when component loads
  useEffect(() => {
  const fetchData = async () => {
    const { data, error } = await supabase.from('public.test').select('*');

    if (error) {
      console.error('Fetch error details:', {
        message: (error as any).message,
        details: (error as any).details,
        hint:    (error as any).hint,
        code:    (error as any).code,
      });
      setTestData([]);
      return;
    }

    setTestData((data ?? []) as TestRow[]);
  };
  fetchData();
}, []);

  // Insert a new record into supabase
  const insertRecord = async () => {
    const { data, error } = await supabase
      .from("test")
      .insert([{ name: "Gerard Test" }])
      .select("*");

    if (error) {
      console.error("Error inserting data:", error);
      return;
    }
    setTestData((prev) => [...prev, ...((data ?? []) as TestRow[])]);
    alert("Record added successfully!");
  };

  // Render page
  return (
    <main style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>Supabase Connectivity Test</h1>
      <button onClick={insertRecord}>Insert Test Record</button>

      {loading ? (
        <p>Loading data...</p>
      ) : (
        <ul>
          {testData.map((row) => (
            <li key={row.id}>
              {row.id}: {row.name} (
              {row.created_at ? new Date(row.created_at).toLocaleString() : "—"})
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
