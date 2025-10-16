'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize the Supabase client
const supabase = createClient(
  'https://lmbsmkvmluspqiynlkiy.supabase.co',  // Replace with your Supabase project URL
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtYnNta3ZtbHVzcHFpeW5sa2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NjA5MDksImV4cCI6MjA3NjEzNjkwOX0.fOMtEug14wbs_VUFucThDwU4GssxPZgKoL070KYsdDE'                  // Replace with your public API key from Supabase
)

export default function Home() {
  const [testData, setTestData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Example: Fetch data from a test table
    const fetchData = async () => {
      const { data, error } = await supabase.from('test').select('*')
      if (error) {
        console.error('Error fetching data:', error)
      } else {
        setTestData(data)
      }
      setLoading(false)
    }

    fetchData()
  }, [])

  // Example: Insert data into Supabase when button is clicked
  const insertRecord = async () => {
    const { data, error } = await supabase
      .from('test')
      .insert([{ name: 'Gerard Test', created_at: new Date() }])
    if (error) console.error('Error inserting data:', error)
    else alert('Record added successfully!')
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h1>Supabase Connectivity Test</h1>
      <button onClick={insertRecord}>Insert Test Record</button>

      {loading ? (
        <p>Loading data...</p>
      ) : (
        <ul>
          {testData.map((row) => (
            <li key={row.id}>
              {row.id}: {row.name} ({new Date(row.created_at).toLocaleString()})
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
