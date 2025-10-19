'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// 1) Define the shape of a row in your `test` table
type TestRow = {
  id: number
  name: string | null
  created_at: string | null
}

// 2) Supabase client (keep your real URL & key)
const supabase = createClient(
  'https://lmbsmkvmluspqiynlkiy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtYnNta3ZtbHVzcHFpeW5sa2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NjA5MDksImV4cCI6MjA3NjEzNjkwOX0.fOMtEug14wbs_VUFucThDwU4GssxPZgKoL070KYsdDE'
)

export default function Home() {
  // 3) Explicitly type the state
  const [testData, setTestData] = useState<TestRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.from('test').select('*')
      if (error) {
        console.error('Error fetching data:', error)
        setTestData([]) // keep state consistent
      } else {
        setTestData((data ?? []) as TestRow[])
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const insertRecord = async () => {
    const { data, error } = await supabase
      .from('test')
      .insert([{ name: 'Gerard Test' }])
      .select('*') // return inserted rows

    if (error) {
      console.error('Error inserting data:', error)
      return
    }
    setTestData(prev => [...prev, ...((data ?? []) as TestRow[])])
    alert('Record added successfully!')
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h1>Supabase Connectivity Test</h1>
      <button onClick={insertRecord}>Insert Test Record</button>

      {loading ? (
        <p>Loading data...</p>
      ) : (
        <ul>
          {testData.map(row => (
            <li key={row.id}>
              {row.id}: {row.name} ({row.created_at ? new Date(row.created_at).toLocaleString() : '—'})
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
