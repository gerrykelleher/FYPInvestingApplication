//tell nextjs this is a client component
//React structure and hook usage (useState, useMemo) based on React.dev official documentation
//https://react.dev/learn
"use client";
import { useMemo, useState } from "react";
import Navbar from "../../components/navbar";

//Types
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
//Follows the standard annuity equation for fixed rate loans.
//Verified using the Corporate Finance Institute – "Loan Payment Formula" (2025).
function pmtLoan(P: number, r: number, n: number) {
  if (r === 0) return P / n;
  const a = Math.pow(1 + r, n);
  return P * (r * a) / (a - 1);
}

//Calculates the monthly payment for a PCP-style loan that includes a final balloon (GMFV).
//Formula derived from the standard annuity equation with a future value term.
//Created with ChatGPT guidance and verified using the Corporate Finance Institute
function pmtWithBalloon(P: number, FV: number, r: number, n: number) {
  if (r === 0) return (P - FV) / n; // simple linear if 0% APR
  const a = Math.pow(1 + r, n);
  return ((P - (FV / a)) * r) / (1 - (1 / a));
}

//Builds the repayment schedule (amortisation table) showing how the loan is paid off.
//Each row includes: payment number, interest, principal, and remaining balance.
//Created with ChatGPT guidance and verified using the Corporate Finance Institute
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
//Main calculation function
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

  //6. Return all results (rounded to 2 decimals)
  return {
    amountFinanced: round2(amountFinanced),
    monthlyPayment: round2(PMT),
    totalMonthlyPaid: round2(totalMonthlyPaid),
    totalAmountRepayable,
    totalCostOfCredit,
    rows,
  };
}

//react component for the car finance simulator page
export default function CarFinanceSimulatorPage() {
  //default values
  const [financeType, setFinanceType] = useState<FinanceType>("loan");
  const [cashPrice, setCashPrice] = useState(25000);
  const [deposit, setDeposit] = useState(5000);
  const [fees, setFees] = useState(0);
  const [aprPct, setAprPct] = useState(6.9);
  const [termMonths, setTermMonths] = useState(60);
  const [balloon, setBalloon] = useState(10000); //used for PCP only
  const [error, setError] = useState<string | null>(null);

  //keep a separate string for the term input to avoid getting stuck at 1
  const [termStr, setTermStr] = useState("60");

  //useMemo recalculates result when inputs change, keeps UI responsive
  const result = useMemo(() => {
    try {
      setError(null);
      const res = calculate({ cashPrice, deposit, fees, aprPct, termMonths, financeType, balloon });
      return res;
    } catch (e: any) {
      setError(e?.message || "Invalid inputs");
      return null;
    }
    //Recalculate when any input changes
  }, [cashPrice, deposit, fees, aprPct, termMonths, financeType, balloon]);

  //UI structure for the simulator page
  //W3Schools ("React Forms") and React.dev documentation, with structure refined
//used ChatGPT as aid
 return (
  <>
    <Navbar />  {/*Added navbar*/}
    <div className="container" style={{ marginTop: "80px" }}> {/*Added margin so it doesn’t overlap */}

      <h1>Car Finance Simulator</h1>
      {/* Instruction line for users */}
      <p style={{ marginBottom: "20px", opacity: 0.8 }}>
        Enter your car details below to simulate your loan repayments and costs.
      </p>
      <p className="lead mt-4">
        Compare a standard <b>car loan</b> vs <b>PCP</b> (with balloon/GMFV).
      </p>

      {/*Card-style wrapper for calculator */}
      <div
        style={{
          backgroundColor: "#f9f9f9",
          borderRadius: "10px",
          padding: "30px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          marginTop: "30px",
        }}
      >
        {/*Inputs*/}
        <div className="grid-2 mt-20">
          <div className="grid-gap-10">
            {/*Finance Type*/}
            <label className="label">
              <span className="tooltip">
                Finance Type
                <span className="tooltiptext">
                  Choose between a <b>standard car loan</b> or a <b>PCP (Personal Contract Plan)</b>. 
                  PCPs include a final payment known as the GMFV.
                </span>
              </span>
              <select
                className="select"
                value={financeType}
                onChange={(e) => setFinanceType(e.target.value as FinanceType)}
              >
                <option value="loan">Loan (no balloon)</option>
                <option value="pcp">PCP (with balloon/GMFV)</option>
              </select>
            </label>

            {/*Car Price Input*/}
            <label className="label">
              <span className="tooltip">
                Cash Price (€)
                <span className="tooltiptext">
                  The full on-the-road price of the vehicle including VAT.
                </span>
              </span>
             <input
              className="input"
              type="number"
              value={cashPrice.toString()}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setCashPrice(Math.min(Math.max(v, 0), 250000));
              }}
              min={0}
              max={250000}
            />

            </label>

            {/*Deposit Input*/}
            <label className="label">
              <span className="tooltip">
                Deposit (€)
                <span className="tooltiptext">
                  The upfront amount you pay before financing. A higher deposit reduces monthly payments.
                </span>
              </span>
              <input
              className="input"
              type="number"
              value={deposit.toString()}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setDeposit(Math.min(Math.max(v, 0), cashPrice));
              }}
              min={0}
              max={cashPrice}
            />
            </label>

            {/*Fees Input*/}
            <label className="label">
              <span className="tooltip">
                Flat Fees (€)
                <span className="tooltiptext">
                  Any one-time admin or documentation charges added to the finance agreement.
                </span>
              </span>
                          <input
              className="input"
              type="number"
              value={fees.toString()}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setFees(Math.min(Math.max(v, 0), 5000));
              }}
              min={0}
              max={5000}
            />
            </label>
          </div>

          {/*Right column inputs*/}
          <div className="grid-gap-10">
            {/*APR Input*/}
            <label className="label">
              <span className="tooltip">
                APR (%)
                <span className="tooltiptext">
                  The <b>Annual Percentage Rate (APR)</b> is the yearly cost of borrowing, 
                  including interest and any fees.
                </span>
              </span>
                        <input
              className="input"
              type="number"
              step="0.01"
              value={aprPct.toString()}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setAprPct(Math.min(Math.max(v, 0), 50));
              }}
              min={0}
              max={50}
            />
            </label>

            {/*Term Input*/}
            <label className="label">
              <span className="tooltip">
                Term (months)
                <span className="tooltiptext">
                  The total number of months you will make repayments over.
                </span>
              </span>
              <input
                className="input"
                type="text"            
                inputMode="numeric"
                pattern="[0-9]*"
                value={termStr}
                onChange={(e) => {
                  const s = e.target.value;
                  if (s === "") { setTermStr(""); return; } //allow empty while typing
                  const num = Number(s);
                  if (Number.isNaN(num)) return; //ignore non-numeric inputs
                  if (num > 96) { setTermStr("96"); setTermMonths(96); return; } //cap high
                  setTermStr(s);
                  if (num >= 1) setTermMonths(num); //only update numeric state when valid
                }}
                onBlur={() => {
                  //on leaving field, clamp to valid range
                  const num = Number(termStr);
                  const clamped = Math.min(Math.max(num || 1, 1), 96);
                  setTermStr(String(clamped));
                  setTermMonths(clamped);
                }}
                placeholder="e.g. 60"
              />
            </label>

            {/*Balloon Input for PCP only*/}
            {financeType === "pcp" && (
              <label className="label">
                <span className="tooltip">
                  Balloon / GMFV at End (€)
                  <span className="tooltiptext">
                    The <b>Guaranteed Minimum Future Value (GMFV)</b> is a final lump-sum due at the end 
                    of a PCP agreement if you wish to keep the car.
                  </span>
                </span>
                <input
                  className="input"
                  type="number"
                  value={balloon.toString()}
                  onChange={(e) => setBalloon(Number(e.target.value) || 0)}
                  min={0}
                  max={cashPrice}
                />
              </label>
            )}

            {/*Amount financed explanation*/}
            <div className="small mt-8">
              <b>Amount financed</b> = Cash Price − Deposit + Fees
            </div>
          </div>
        </div>

        {/*Errors*/}
        {error && (
          <p className="text-danger mt-12">
            {error}
          </p>
        )}

        {/*Results*/}
        {result && !error && (
          <div className="mt-24">
            <h2>Results</h2>
            <div className="grid-4 mt-8">
              <Stat label="Amount financed" value={`€${result.amountFinanced.toFixed(2)}`} />
              <Stat label="Monthly repayment" value={`€${result.monthlyPayment.toFixed(2)}`} />
              <Stat label="Total amount repayable" value={`€${result.totalAmountRepayable.toFixed(2)}`} />
              <Stat label="Total cost of credit" value={`€${result.totalCostOfCredit.toFixed(2)}`} />
            </div>

            {/*Repayments table*/}
            <h3 className="mt-24">Repayments (first 12 months)</h3>
            <table className="table mt-8">
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

            {/*PCP note*/}
            {financeType === "pcp" && (
              <p className="small mt-12">
                PCP leaves a final <b>balloon/GMFV</b> due at the end of the term. The balance above
                will reduce but not reach €0 within the term.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  </>
);
}

//neat table for displaying a label and value
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="stat-key">{label}</div>
      <div className="stat-val">{value}</div>
    </div>
  );
}

//table header styling
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="th">
      {children}
    </th>
  );
}
//cell styling
function Td({ children }: { children: React.ReactNode }) {
  return <td className="td">{children}</td>;
}


//---Code References---
//PMT (annuity) formula and approach adapted from: Corporate Finance Institute (CFI), "Loan Payment Formula" (accessed Nov 2025).
//used ChatGPT (OpenAI, 2025) to help me understand the structure of the PMT formula and to assist in converting it into a working TypeScript function.
//Validations and rounding logic was written by me and all tests were done by me.
//https://corporatefinanceinstitute.com/resources/wealth-management/annuity/

//React structure and hook usage (useState, useMemo) based on React.dev official documentation
//https://react.dev/learn

//Input handling and form structure adapted from W3Schools "React Forms" (accessed Nov 2025):
//https://www.w3schools.com/react/react_forms.asp

//Tooltips: structure and CSS adapted from W3Schools "CSS Tooltip" examples (accessed Nov 2025), then customised to suit this project
//https://www.w3schools.com/css/css_tooltip.asp

//Navbar style adapted from W3Schools "CSS Horizontal Navigation Bar"(accessed Nov 2025), then customised to suit this project.
//https://www.w3schools.com/Css/css_navbar_horizontal.asp
//https://www.w3schools.com/react/react_router.asp