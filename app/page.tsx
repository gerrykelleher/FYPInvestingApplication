//Code adapted from W3Schools (2025) React Router and Styling Examples
// https://www.w3schools.com/react/react_router.asp
// https://www.w3schools.com/react/react_styling.asp

"use client";
import Link from "next/link";
import type { CSSProperties } from "react";

export default function Home() {
  // Type the style objects so TS accepts CSS values like "center" for textAlign
  const pageStyle: CSSProperties = {
    textAlign: "center",
    fontFamily: "Arial, sans-serif",
    padding: "50px",
  };

  const buttonStyle: CSSProperties = {
    display: "inline-block",
    margin: "10px",
    padding: "12px 24px",
    borderRadius: "6px",
    backgroundColor: "#0070f3",
    color: "white",
    textDecoration: "none",
    fontWeight: "bold",
  };

  return (
    <div style={pageStyle}>
      <h1>Financial Literacy Classroom Tools</h1>
      <p>
        Choose a simulator below to explore how borrowing, repayments, and
        interest work.
      </p>

      {/*Navigation Links*/}
      <div>
        <Link href="/simulate/car" style={buttonStyle}>
          🚗 Car Finance Simulator
        </Link>

        <Link href="/simulate/mortgage" style={buttonStyle}>
          🏠 Mortgage Simulator
        </Link>
      </div>

      {/* Optional note or dev link */}
      <div style={{ marginTop: "40px", fontSize: "14px", color: "#666" }}>
        <p>
          Educational simulator built for financial literacy classes in Ireland.
        </p>
        <p>
          <Link
            href="/supabase-test"
            style={{ color: "#0070f3", textDecoration: "underline" }}
          >
            Developer Test Page
          </Link>
        </p>
      </div>

      {/*Hover effect*/}
      <style jsx>{`
        a:hover {
          background-color: #0056c2;
          color: white;
          transition: 0.15s ease-in-out;
        }
      `}</style>
    </div>
  );
}
