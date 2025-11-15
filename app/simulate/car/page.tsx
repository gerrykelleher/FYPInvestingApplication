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

//Simulation-specific types
type LoanState = {
  financeType: FinanceType;
  principal: number;            // amount financed (remaining) – simplified aggregate
  balloon: number;              // PCP balloon (GMFV) if relevant
  annualRate: number;           // decimal, e.g. 0.069
  termMonthsRemaining: number;  // months remaining in the agreement
  monthlyPayment: number;       // recalculated after each scenario
  totalInterestOnFinance: number; // interest over remaining term based on principal
  currentMonth: number;         // for time-based scenarios if needed
};

// A single choice inside a scenario
type ScenarioChoice = {
  id: string;
  label: string;
  apply: (loan: LoanState) => LoanState; //function that applies this choice to a LoanState
  explanation: string;                   //text explaining the impact of this choice
  nextScenarioId?: number;               //optional next scenario id to go to after this choice
};

//Scenario node structure
//https://www.geeksforgeeks.org/reactjs/create-a-text-based-adventure-game-using-react/
type ScenarioNode = {
  id: number;
  title: string;
  description: string;
  choices: ScenarioChoice[];
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

//Simulation logic functions
//Recalculate monthly payment and interest from a LoanState.
//This is used whenever a scenario choice changes the loan details.
function recalcLoanFromState(loan: LoanState): LoanState {
  const monthlyRate = loan.annualRate / 12;

  const pmt =
    loan.financeType === "loan"
      ? pmtLoan(loan.principal, monthlyRate, loan.termMonthsRemaining)
      : pmtWithBalloon(loan.principal, loan.balloon, monthlyRate, loan.termMonthsRemaining);

  const totalRepaid =
    pmt * loan.termMonthsRemaining +
    (loan.financeType === "pcp" ? loan.balloon : 0);

  const totalInterest = round2(totalRepaid - loan.principal);

  return {
    ...loan,
    monthlyPayment: round2(pmt),
    totalInterestOnFinance: totalInterest,
  };
}

//Create the initial LoanState from user inputs and calculation result.
//This is adapted from the GeeksforGeeks text adventure code structure.
function createInitialLoanState(inputs: Inputs, result: Result): LoanState {
  const base: LoanState = {
    financeType: inputs.financeType,
    principal: result.amountFinanced,
    balloon: inputs.financeType === "pcp" ? inputs.balloon : 0,
    annualRate: inputs.aprPct / 100,
    termMonthsRemaining: inputs.termMonths,
    monthlyPayment: 0,           //filled by recalcLoanFromState
    totalInterestOnFinance: 0,   //filled by recalcLoanFromState
    currentMonth: 0,
  };
  return recalcLoanFromState(base);
}

//Scenarios
const loanScenarios: ScenarioNode[] = [
  {
    id: 0,
    title: "Interest Rate Increase",
    description:
      "After one year, your lender increases the interest rate on your finance by 1%. How would you like to respond?",
    choices: [
      {
        id: "rate-up-keep-term",
        label: "Accept higher monthly repayment (keep the same term)",
        apply: (loan) => {
          const updated: LoanState = {
            ...loan,
            annualRate: loan.annualRate + 0.01,
            //terms remaining
            currentMonth: loan.currentMonth + 12,
          };
          return recalcLoanFromState(updated);
        },
        explanation:
          "You decided to keep the same term. Your monthly repayment goes up immediately, but you still finish the loan on time.",
        nextScenarioId: 1,
      },
      {
        id: "rate-up-extend-term",
        label: "Extend the term by 12 months to reduce the monthly cost",
        apply: (loan) => {
          const updated: LoanState = {
            ...loan,
            annualRate: loan.annualRate + 0.01,
            termMonthsRemaining: loan.termMonthsRemaining + 12,
            currentMonth: loan.currentMonth + 12,
          };
          return recalcLoanFromState(updated);
        },
        explanation:
          "By extending the term you reduce your monthly repayment, but you pay interest for longer and the total cost of credit increases.",
        nextScenarioId: 1,
      },
    ],
  },
  {
    id: 1,
    title: "Missed Payment",
    description:
      "You miss one monthly repayment due to an unexpected expense. Your lender gives you two options to get back on track.",
    choices: [
      {
        id: "catch-up-fee",
        label: "Catch up next month and pay a €50 late fee",
        apply: (loan) => {
          const updated: LoanState = {
            ...loan,
            principal: loan.principal + 50, //fee added on
          };
          return recalcLoanFromState(updated);
        },
        explanation:
          "You paid a fee and caught up quickly. Your principal and total interest are slightly higher, but the original schedule is mostly intact.",
        nextScenarioId: 2,
      },
      {
        id: "add-payment-end",
        label: "Add the missed payment to the end of the agreement (extend term by 1 month)",
        apply: (loan) => {
          const updated: LoanState = {
            ...loan,
            termMonthsRemaining: loan.termMonthsRemaining + 1,
          };
          return recalcLoanFromState(updated);
        },
        explanation:
          "You avoided a fee, but you added an extra month to the loan. This keeps payments manageable but increases the total interest paid.",
        nextScenarioId: 2,
      },
    ],
  },
  {
    id: 2,
    title: "Bonus Lump Sum",
    description:
      "You receive a €2,000 bonus from work. You are considering using it to reduce your finance balance.",
    choices: [
      {
        id: "pay-off-2000",
        label: "Pay €2,000 off the finance balance now",
        apply: (loan) => {
          const newPrincipal = Math.max(loan.principal - 2000, 0);
          const updated: LoanState = {
            ...loan,
            principal: newPrincipal,
          };
          return recalcLoanFromState(updated);
        },
        explanation:
          "Using the bonus reduces your principal. This lowers the interest charged and could reduce either your monthly repayment or the effective time in debt.",
      },
      {
        id: "keep-cash",
        label: "Keep the bonus in savings for emergencies",
        apply: (loan) => loan,
        explanation:
          "You chose not to change the loan. Your repayments and interest stay the same, but you have a cash buffer to cover future shocks.",
      },
    ],
  },
];

//Child component: responsible only for rendering the current scenario and choices.
//Pattern inspired by "Story" component in GeeksforGeeks text adventure.
//Layout and card styling adapted from W3Schools "How to - cards"
function LoanScenarioView({
  scenario,
  onChoose,
}: {
  scenario: ScenarioNode;
  onChoose: (choice: ScenarioChoice) => void;
}) {
  return (
    <div
      className="card mx-auto mt-4"
      style={{
        maxWidth: "720px",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
        backgroundColor: "#ffffff",
      }}
    >
      <div className="card-body">
        <h2
          className="card-title"
          style={{ marginBottom: "8px", fontSize: "1.4rem" }}
        >
          {scenario.title}
        </h2>
        <p
          className="card-text"
          style={{ marginBottom: "16px", opacity: 0.9, lineHeight: 1.5 }}
        >
          {scenario.description}
        </p>

        {/* Buttons styled as a vertical choice list – pattern adapted from W3Schools button groups */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {scenario.choices.map((choice) => (
            <button
              key={choice.id}
              className="btn interactive-choice"
              onClick={(e) => {
                //ripple effect
                const ripple = document.createElement("span");
                ripple.className = "ripple";
                e.currentTarget.appendChild(ripple);
                setTimeout(() => ripple.remove(), 500);

                onChoose(choice);
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

//Parent component: holds the current LoanState & scenario id.
//Pattern inspired by "Game" component in GeeksforGeeks text adventure.
//Layout and progress bar adapted from W3Schools "How To - Progress Bars"
function LoanSimulation({
  initialLoan,
  onExit,
}: {
  initialLoan: LoanState;
  onExit: () => void;
}) {
  const [loan, setLoan] = useState<LoanState>(initialLoan);
  const [scenarioId, setScenarioId] = useState<number>(0);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [previousLoan, setPreviousLoan] = useState<LoanState | null>(null);

  const scenario = loanScenarios.find((s) => s.id === scenarioId);
  const totalScenarios = loanScenarios.length;
  const currentIndex = scenario
    ? loanScenarios.findIndex((s) => s.id === scenario.id) + 1
    : totalScenarios;

  const progressPct =
    totalScenarios > 0 ? (currentIndex / totalScenarios) * 100 : 0;

  function handleChoice(choice: ScenarioChoice) {
    // store current loan for before/after comparison
    setPreviousLoan(loan);

    const updatedLoan = choice.apply(loan);
    setLoan(updatedLoan);
    setExplanation(choice.explanation);

    if (typeof choice.nextScenarioId === "number") {
      setScenarioId(choice.nextScenarioId);
    } else {
      //no next scenario defined, mark as finished
      setScenarioId(-1);
    }
  }

  function handleRestart() {
    setLoan(initialLoan);
    setScenarioId(0);
    setExplanation(null);
    setPreviousLoan(null);
  }

  // helper to render change arrows/colour
  function renderChange(before: number, after: number, isRate = false) {
    if (after > before) {
      return (
        <span style={{ color: "#b91c1c", fontWeight: 500 }}>
          {isRate ? after.toFixed(2) + "%" : "€" + after.toFixed(2)} ▲
        </span>
      );
    }
    if (after < before) {
      return (
        <span style={{ color: "#15803d", fontWeight: 500 }}>
          {isRate ? after.toFixed(2) + "%" : "€" + after.toFixed(2)} ▼
        </span>
      );
    }
    return (
      <span style={{ opacity: 0.8 }}>
        {isRate ? after.toFixed(2) + "%" : "€" + after.toFixed(2)}
      </span>
    );
  }

  function renderMonthsChange(before: number, after: number) {
    if (after > before) {
      return (
        <span style={{ color: "#b91c1c", fontWeight: 500 }}>
          {after} months ▲
        </span>
      );
    }
    if (after < before) {
      return (
        <span style={{ color: "#15803d", fontWeight: 500 }}>
          {after} months ▼
        </span>
      );
    }
    return <span style={{ opacity: 0.8 }}>{after} months</span>;
  }

  return (
    <div
      style={{
        backgroundColor: "#f3f4f6",
        minHeight: "100vh",
        paddingTop: "80px",
      }}
    >
      <div
        className="container"
        style={{ maxWidth: "960px", margin: "0 auto 40px auto" }}
      >
        <h1 style={{ textAlign: "center" }}>Car Loan Simulation</h1>
        <p
          className="lead mt-3"
          style={{ textAlign: "center", opacity: 0.85 }}
        >
          Make decisions and see how they change your repayments, term and total
          interest over time.
        </p>

        {/* Progress bar (adapted from W3Schools progress bar example) */}
        <div
          style={{
            margin: "20px auto 10px auto",
            maxWidth: "480px",
            backgroundColor: "#e5e7eb",
            borderRadius: "999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "10px",
              width: `${progressPct}%`,
              background:
                "linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #22c55e 100%)",
              transition: "width 0.25s ease-out",
            }}
          />
        </div>
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          {scenario ? (
            <span className="small">
              Scenario {currentIndex} of {totalScenarios}
            </span>
          ) : (
            <span className="small">Simulation complete</span>
          )}
        </div>

        {/* Loan summary card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "14px",
            padding: "24px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            marginTop: "10px",
            marginBottom: "10px",
          }}
        >
          <p>
            <b>Principal remaining:</b> €{loan.principal.toFixed(2)}
          </p>
          <p>
            <b>Annual interest rate:</b>{" "}
            {(loan.annualRate * 100).toFixed(2)}%
          </p>
          <p>
            <b>Term remaining:</b> {loan.termMonthsRemaining} months
          </p>
          <p>
            <b>Monthly repayment:</b> €{loan.monthlyPayment.toFixed(2)}
          </p>
          <p>
            <b>Total interest on this finance:</b> €
            {loan.totalInterestOnFinance.toFixed(2)}
          </p>
          {loan.financeType === "pcp" && (
            <p>
              <b>Balloon / GMFV at end:</b> €{loan.balloon.toFixed(2)}
            </p>
          )}
        </div>

        {/* Before vs After comparison for the last decision */}
        {previousLoan && (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              padding: "18px 20px",
              boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
              marginBottom: "16px",
              maxWidth: "720px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <h5 style={{ marginBottom: "10px" }}>Impact of your last decision</h5>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.9rem",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th
                    style={{
                      textAlign: "left",
                      paddingBottom: "6px",
                      fontWeight: 600,
                    }}
                  >
                    Metric
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      paddingBottom: "6px",
                      fontWeight: 600,
                    }}
                  >
                    Before
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      paddingBottom: "6px",
                      fontWeight: 600,
                    }}
                  >
                    After
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 0" }}>Monthly repayment</td>
                  <td style={{ padding: "4px 0" }}>
                    €{previousLoan.monthlyPayment.toFixed(2)}
                  </td>
                  <td style={{ padding: "4px 0" }}>
                    {renderChange(
                      previousLoan.monthlyPayment,
                      loan.monthlyPayment
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0" }}>Total interest</td>
                  <td style={{ padding: "4px 0" }}>
                    €{previousLoan.totalInterestOnFinance.toFixed(2)}
                  </td>
                  <td style={{ padding: "4px 0" }}>
                    {renderChange(
                      previousLoan.totalInterestOnFinance,
                      loan.totalInterestOnFinance
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0" }}>Term remaining</td>
                  <td style={{ padding: "4px 0" }}>
                    {previousLoan.termMonthsRemaining} months
                  </td>
                  <td style={{ padding: "4px 0" }}>
                    {renderMonthsChange(
                      previousLoan.termMonthsRemaining,
                      loan.termMonthsRemaining
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0" }}>Annual interest rate</td>
                  <td style={{ padding: "4px 0" }}>
                    {(previousLoan.annualRate * 100).toFixed(2)}%
                  </td>
                  <td style={{ padding: "4px 0" }}>
                    {renderChange(
                      previousLoan.annualRate * 100,
                      loan.annualRate * 100,
                      true
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Scenario or completion message */}
        {scenario ? (
          <LoanScenarioView scenario={scenario} onChoose={handleChoice} />
        ) : (
          <div
            className="card mt-4 mx-auto"
            style={{
              maxWidth: "720px",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            <div className="card-body">
              <h2 className="card-title">Simulation complete</h2>
              <p className="card-text">
                You have reached the end of the current set of scenarios. You
                can restart, or go back to the calculator to try different loan
                details.
              </p>
              <button className="btn btn-secondary" onClick={handleRestart}>
                Restart Simulation
              </button>
              <button
                className="btn btn-outline-primary"
                style={{ marginLeft: "10px" }}
                onClick={onExit}
              >
                Back to Calculator
              </button>
            </div>
          </div>
        )}

        {explanation && (
          <p
            className="small mt-3"
            style={{
              maxWidth: "720px",
              margin: "0 auto",
              opacity: 0.9,
              lineHeight: 1.5,
            }}
          >
            <b>What this means:</b> {explanation}
          </p>
        )}

        <div
          style={{
            marginTop: "16px",
            display: "flex",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          <button className="btn btn-secondary" onClick={handleRestart}>
            Restart Simulation
          </button>
          <button className="btn btn-outline-primary" onClick={onExit}>
            Back to Calculator
          </button>
        </div>
      </div>
    </div>
  );
}

//react component for the car finance simulator page
export default function CarFinanceSimulatorPage() {
  // mode switching: calculator vs simulator
  const [mode, setMode] = useState<"setup" | "simulate">("setup");
  const [simLoan, setSimLoan] = useState<LoanState | null>(null);

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

  //Start the simulator with the current inputs
  function handleBeginSimulator() {
    if (!result || error) return;
    const inputs: Inputs = { cashPrice, deposit, fees, aprPct, termMonths, financeType, balloon };
    const initialLoan = createInitialLoanState(inputs, result);
    setSimLoan(initialLoan);
    setMode("simulate");
  }

  //UI structure for the simulator page
  //W3Schools ("React Forms") and React.dev documentation, with structure refined
  //used ChatGPT as aid
  return (
    <>
      <Navbar />  {/*Added navbar*/}

      {/* SETUP / CALCULATOR MODE */}
      {mode === "setup" && (
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

                {/*Begin Simulator button*/}
                <button className="btn btn-primary mt-24" onClick={handleBeginSimulator}>
                  Begin Simulator
                </button>
                <p className="small mt-2" style={{ opacity: 0.8 }}>
                  Start the simulator to see how real-life scenarios affect your repayments.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/*simulation – uses the Game/Story-style structure inspired by GeeksforGeeks*/}
      {mode === "simulate" && simLoan && (
        <LoanSimulation
          initialLoan={simLoan}
          onExit={() => {
            setMode("setup");
            setSimLoan(null);
          }}
        />
      )}
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

//Scenario engine structure (parent holds current scenario + state, child renders scenario from an array)
//adapted from the pattern in GeeksforGeeks "Create a Text-based Adventure Game using React":
//Used ChatGPT as aid to adapt the structure to my loan simulation context.
//https://www.geeksforgeeks.org/reactjs/create-a-text-based-adventure-game-using-react/

//Card layout for scenario view adapted from W3Schools "How to - CSS Cards" (accessed Nov 2025):
//https://www.w3schools.com/howto/howto_css_cards.asp

//Progress bar style adapted from W3Schools "How To - CSS Progress Bars" (accessed Nov 2025):
//https://www.w3schools.com/howto/howto_css_progressbar.asp

//Button styling and interactive effects (hover, active, ripple) adapted from W3Schools "How To - Animated Buttons",
//"How To - Ripple Effect Button" and "How To - Button Groups" (accessed Nov 2025):
//https://www.w3schools.com/howto/howto_css_animate_buttons.asp
//https://www.w3schools.com/howto/howto_css_ripple_buttons.asp
//https://www.w3schools.com/howto/howto_css_button_group.asp
