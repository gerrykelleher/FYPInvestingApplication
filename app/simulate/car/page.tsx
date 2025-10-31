//tell nextjs this is a client component
"use client";
import { useMemo, useState } from "react";

// ---- Types
type FinanceType = "loan" | "pcp";

type Inputs = {
  cashPrice: number;     //vehicle cash price(including VAT)
  deposit: number;       //upfront customer deposit
  fees: number;          //flat fees added
  aprPct: number;        //annual percentage rate (APR) as %
  termMonths: number;    //number of mobths to repay
  financeType: FinanceType;
  balloon: number;       //PCP only: the big final payment (GMFV) if you want to keep the car at the end
};

type Row = { period: number; payment: number; interest: number; principal: number; balance: number; };

type Result = {
  amountFinanced: number;   //cashPrice - deposit + fees
  monthlyPayment: number;   //monthly repayment
  totalMonthlyPaid: number; //total of all monthly payments
  totalAmountRepayable: number; //deposit + fees + totalMonthlyPaid (+ balloon if PCP)
  totalCostOfCredit: number;    //totalAmountRepayable - cashPrice
  rows: Row[];  //repayment schedule rows (first 12 months)
};

//currency rounding
function round2(x: number) {
  return Math.round(x * 100) / 100;
}

//PMT formula function generated with ChatGPT guidance
//Follows the standard annuity equation for fixed-rate loans.
//Verified using the Corporate Finance Institute – "Loan Payment Formula" (2025).
function pmtLoan(P: number, r: number, n: number) {
  if (r === 0) return P / n;
  const a = Math.pow(1 + r, n);
  return P * (r * a) / (a - 1);
}

// Calculates the monthly payment for a PCP-style loan that includes a final balloon (GMFV).
// Formula derived from the standard annuity equation with a future value term.
// Created with ChatGPT guidance and verified using the Corporate Finance Institute
function pmtWithBalloon(P: number, FV: number, r: number, n: number) {
  if (r === 0) return (P - FV) / n; // simple linear if 0% APR
  const a = Math.pow(1 + r, n);
  return ((P - (FV / a)) * r) / (1 - (1 / a));
}

// Builds the repayment schedule (amortisation table) showing how the loan is paid off.
// Each row includes: payment number, interest, principal, and remaining balance.
// Created with ChatGPT guidance and verified using the Corporate Finance Institute
function buildAmortizationRows(P: number, r: number, n: number, PMT: number): Row[] {
  const rows: Row[] = [];
  let bal = P;

  const maxRows = Math.min(12, n);  //only show first 12 months
  for (let k = 1; k <= maxRows; k++) {
    const interest = bal * r;
    const principal = PMT - interest;
    bal = bal + interest - PMT; //update balance, add interest, subtract payment
    rows.push({
      period: k,
      payment: round2(PMT),
      interest: round2(interest),
      principal: round2(principal),
      balance: round2(Math.max(bal, 0)), //avoid negative balance
    });
  }
  return rows;
}

/**
 * Core calculator used by the page.
 * - Uses APR% as nominal annual rate -> monthly rate r
 * - amountFinanced = cashPrice - deposit + fees
 * - For PCP, leaves "balloon" due at the end.
 */
function calculate(inputs: Inputs): Result {
    //inputs broken into seperate variables
  const { cashPrice, deposit, fees, aprPct, termMonths, financeType, balloon } = inputs;

  //input validation
  if (cashPrice <= 0) throw new Error("Cash price must be > 0");
  if (deposit < 0 || fees < 0) throw new Error("Deposit/fees cannot be negative");
  if (termMonths <= 0) throw new Error("Term must be > 0 months");
  if (aprPct < 0) throw new Error("APR cannot be negative");
  if (financeType === "pcp" && balloon < 0) throw new Error("Balloon cannot be negative");
  if (financeType === "pcp" && balloon >= cashPrice)
    throw new Error("Balloon/GMFV should be less than the cash price"); 

  //1. Calculate amount financed
        //cashPrice - deposit + fees
  const amountFinanced = Math.max(0, cashPrice - deposit + fees);
  //2. Convert APR% to monthly rate
  const r = aprPct / 100 / 12;

  //3. Calculate monthly payment (PMT) based on finance type
  const PMT =
    financeType === "loan"
      ? pmtLoan(amountFinanced, r, termMonths)
      : pmtWithBalloon(amountFinanced, balloon, r, termMonths);
      //4. Work out totals
  const totalMonthlyPaid = PMT * termMonths;
  //totalAmountRepayable = deposit + fees + totalMonthlyPaid (+ balloon if PCP)
  const totalAmountRepayable =
    round2(deposit + fees + totalMonthlyPaid + (financeType === "pcp" ? balloon : 0));
    
    //totalCostOfCredit = totalAmountRepayable - cashPrice
  const totalCostOfCredit = round2(totalAmountRepayable - cashPrice);

  //5. Repayment schedule rows (first 12 months)
  const rows = buildAmortizationRows(amountFinanced, r, termMonths, PMT);

  //6. Return all results
  return {
    amountFinanced: round2(amountFinanced),
    monthlyPayment: round2(PMT),
    totalMonthlyPaid: round2(totalMonthlyPaid),
    totalAmountRepayable,
    totalCostOfCredit,
    rows,
  };
}

// ---- Page component
export default function CarFinanceSimulatorPage() {
  // Sensible Irish defaults for a classroom demo
  const [financeType, setFinanceType] = useState<FinanceType>("loan");
  const [cashPrice, setCashPrice] = useState(25000);
  const [deposit, setDeposit] = useState(5000);
  const [fees, setFees] = useState(0);
  const [aprPct, setAprPct] = useState(6.9);
  const [termMonths, setTermMonths] = useState(60);
  const [balloon, setBalloon] = useState(10000); // used for PCP only
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    try {
      setError(null);
      const res = calculate({ cashPrice, deposit, fees, aprPct, termMonths, financeType, balloon });
      return res;
    } catch (e: any) {
      setError(e?.message || "Invalid inputs");
      return null;
    }
    // Recalculate when any input changes
  }, [cashPrice, deposit, fees, aprPct, termMonths, financeType, balloon]);

  return (
    <div style={{ maxWidth: 880, margin: "40px auto", padding: 16 }}>
      <h1>Car Finance Simulator (Ireland)</h1>
      <p style={{ opacity: 0.8, marginTop: 4 }}>
        Compare a standard <b>car loan</b> vs <b>PCP</b> (with balloon/GMFV). Shows Irish-style outputs:
        <i> Monthly repayment, Total amount repayable, Total cost of credit.</i>
      </p>

      {/* Inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <label>
            Finance Type
            <select
              value={financeType}
              onChange={(e) => setFinanceType(e.target.value as FinanceType)}
            >
              <option value="loan">Loan (no balloon)</option>
              <option value="pcp">PCP (with balloon/GMFV)</option>
            </select>
          </label>

          <label>
            Cash Price (€)
            <input
              type="number"
              value={cashPrice}
              onChange={(e) => setCashPrice(Number(e.target.value))}
              min={0}
            />
          </label>

          <label>
            Deposit (€)
            <input
              type="number"
              value={deposit}
              onChange={(e) => setDeposit(Number(e.target.value))}
              min={0}
            />
          </label>

          <label>
            Flat Fees (€)
            <input
              type="number"
              value={fees}
              onChange={(e) => setFees(Number(e.target.value))}
              min={0}
            />
          </label>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label>
            APR (%)
            <input
              type="number"
              step="0.01"
              value={aprPct}
              onChange={(e) => setAprPct(Number(e.target.value))}
              min={0}
            />
          </label>

          <label>
            Term (months)
            <input
              type="number"
              value={termMonths}
              onChange={(e) => setTermMonths(Number(e.target.value))}
              min={1}
            />
          </label>

          {financeType === "pcp" && (
            <label>
              Balloon / GMFV at End (€)
              <input
                type="number"
                value={balloon}
                onChange={(e) => setBalloon(Number(e.target.value))}
                min={0}
                max={cashPrice}
              />
            </label>
          )}

          <div style={{ fontSize: 12, opacity: 0.8 }}>
            <b>Amount financed</b> = Cash Price − Deposit + Fees
          </div>
        </div>
      </div>

      {/* Errors */}
      {error && (
        <p style={{ color: "crimson", marginTop: 12 }}>
          {error}
        </p>
      )}

      {/* Results */}
      {result && !error && (
        <div style={{ marginTop: 24 }}>
          <h2>Results</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(140px, 1fr))",
              gap: 14,
              marginTop: 8,
            }}
          >
            <Stat label="Amount financed" value={`€${result.amountFinanced.toFixed(2)}`} />
            <Stat label="Monthly repayment" value={`€${result.monthlyPayment.toFixed(2)}`} />
            <Stat label="Total amount repayable" value={`€${result.totalAmountRepayable.toFixed(2)}`} />
            <Stat label="Total cost of credit" value={`€${result.totalCostOfCredit.toFixed(2)}`} />
          </div>

          <h3 style={{ marginTop: 24 }}>Amortization (first 12 months)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Payment</Th>
                <Th>Interest</Th>
                <Th>Principal</Th>
                <Th>Balance</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.period}>
                  <Td>{r.period}</Td>
                  <Td>€{r.payment.toFixed(2)}</Td>
                  <Td>€{r.interest.toFixed(2)}</Td>
                  <Td>€{r.principal.toFixed(2)}</Td>
                  <Td>€{r.balance.toFixed(2)}</Td>
                </tr>
              ))}
            </tbody>
          </table>

          {/** PCP note */}
          {financeType === "pcp" && (
            <p style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>
              PCP leaves a final <b>balloon/GMFV</b> due at the end of the term. The balance above
              will reduce but not reach €0 within the term.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Tiny presentational helpers
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 6px" }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "8px 6px", borderBottom: "1px solid #f1f5f9" }}>{children}</td>;
}
