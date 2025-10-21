'use client'  //Tell Next.js this is a client component
import { useEffect, useState } from 'react' //import React hooks so the app remembers and reacts to changes
import { createClient } from '@supabase/supabase-js' //import Supabase client

//defines what a row in the "test" table looks like
type TestRow = {
  id: number
  name: string | null
  created_at: string | null
}

//connection to my supabase project
const supabase = createClient(
  'https://lmbsmkvmluspqiynlkiy.supabase.co', //url
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtYnNta3ZtbHVzcHFpeW5sa2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NjA5MDksImV4cCI6MjA3NjEzNjkwOX0.fOMtEug14wbs_VUFucThDwU4GssxPZgKoL070KYsdDE' //anon key
)

export default function Home() {
  //state variables
  const [testData, setTestData] = useState<TestRow[]>([]) //stores supabase rows
  const [loading, setLoading] = useState<boolean>(true) //loading status

  //fetches all data from supabase when loaded
  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.from('test').select('*')
      if (error) {
        console.error('Error fetching data:', error)
        setTestData([]) //if theres an error, set to empty 
      } else {
        setTestData((data ?? []) as TestRow[]) //store data if no error
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  //inserts a new record into supabase
  const insertRecord = async () => {
    const { data, error } = await supabase
      .from('test')
      .insert([{ name: 'Gerard Test' }]) //data to insert
      .select('*') //return the inserted data

    if (error) {
      console.error('Error inserting data:', error)
      return
    }
    //adds the new record and confirms success
    setTestData(prev => [...prev, ...((data ?? []) as TestRow[])])
    alert('Record added successfully!')
  }
//renders page
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
