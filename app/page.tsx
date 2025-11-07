//Code adapted from W3Schools (2025) React Router and Styling Examples
// https://www.w3schools.com/react/react_router.asp
// https://www.w3schools.com/react/react_styling.asp

"use client";
import Link from "next/link";
import type { CSSProperties } from "react";

export default function Home() {

  // Page layout and typography
  const pageStyle: CSSProperties = {
    textAlign: "center",
    fontFamily: "Arial, sans-serif",
    padding: "60px 20px",
    backgroundColor: "#f9fafb",
    minHeight: "100vh",
  };

  // Button style for navigation links
  const buttonStyle: CSSProperties = {
    display: "inline-block",
    margin: "10px",
    padding: "14px 28px",
    borderRadius: "8px",
    backgroundColor: "#0070f3",
    color: "white",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "16px",
    transition: "all 0.3s ease",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  };

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: "32px", color: "#111" }}>
        Financial Literacy Classroom Tools
      </h1>

      <p style={{ marginTop: "10px", color: "#444", fontSize: "17px" }}>
        Learn how borrowing and repayments work through interactive simulators.
      </p>

      {/* Navigation Buttons */}
      <div style={{ marginTop: "50px" }}>
        <Link href="/simulate/car" style={buttonStyle}>
          🚗 Car Finance Simulator
        </Link>

        <Link href="/simulate/mortgage" style={buttonStyle}>
          🏠 Mortgage Simulator
        </Link>
      </div>

      {/* Learn m link */}
      <div style={{ marginTop: "30px" }}>
        <Link
          href="/learn"
          style={{
            display: "inline-block",
            backgroundColor: "#e5e7eb",
            color: "#333",
            padding: "10px 20px",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "600",
            fontSize: "15px",
          }}
        >
          ℹ️ Learn More
        </Link>
      </div>

      {/* About/Extra info */}
      <div style={{ marginTop: "60px", fontSize: "15px", color: "#555" }}>
        <p>
          Educational simulator built for financial literacy classes in Ireland.
        </p>
        <p>
          <Link
            href="/supabase-test"
            style={{
              color: "#0070f3",
              textDecoration: "underline",
              fontWeight: "bold",
            }}
          >
            Test Supabase Connectivity
          </Link>
        </p>
      </div>

      {/* Hover and focus effects for buttons */}
      <style jsx>{`
        a:hover {
          background-color: #0059c1;
          transform: scale(1.05);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
          color: #fff;
        }
        a:focus {
          outline: 2px solid #0059c1;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
