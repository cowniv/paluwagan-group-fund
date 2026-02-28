# 25 · Paluwagan Group Fund

**Roadmap stage:** Phase 8 – Full-Stack · February 2026

**Inspired by:** Kolektibo, the AI-governed group treasury I built for a hackathon. This is the student version with no blockchain and no AI: just the core idea of a shared fund where nobody can move money alone.

A paluwagan is the Filipino rotating savings group: everyone chips in the same amount every cycle, and each cycle one member takes home the whole pot. It runs on trust, and it usually lives in a group chat and someone's notebook. I wanted a tracker where every payment has a proof note, every payout needs the group's approval, and every action ends up in an audit log.

### Features
- Sign up / log in with **JWT** auth (passwords hashed with **bcryptjs**)
- Create a group: contribution amount, schedule (weekly, every 2 weeks, monthly), first due date, members by email
- **Rotation order** for payouts, either as listed or drawn randomly (bunutan)
- Record your contribution for a cycle with a **proof note** (e.g. a GCash reference number)
- **Who-has-paid** status for every cycle
- **Multi-approval payouts**: a payout can only be requested once everyone has paid, and it is released only when a **strict majority of the other members** approve. The recipient can't vote on their own payout
- **Ledger** with a running balance (contributions in, released payouts out)
- **Overdue view** with days late and a prefilled reminder email
- **Audit log** of every action in the group
- Business rules live in one pure module (`server/src/rules.js`) with unit tests, plus an API test that runs the whole flow on an in-memory SQLite database

### Tech
Express · better-sqlite3 · JWT (`jsonwebtoken`) · bcryptjs · React 18 · TypeScript · Vite · Tailwind CSS v4 · node:test

### Run
