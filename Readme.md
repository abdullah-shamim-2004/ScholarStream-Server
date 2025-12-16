
# ScholarStream Server

**ScholarStream Server** is the backend API for the ScholarStream platform, a scholarship management system. It handles authentication, payment processing via Stripe, user management, application submissions, and data analytics.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Running the Server](#running-the-server)
- [API Endpoints](#api-endpoints)
- [Stripe Payment Flow](#stripe-payment-flow)
- [License](#license)

---

## Features

- User authentication (Firebase Auth )
- Role-based access: Admin, Moderator, Student
- Manage Scholarships: Create, Read, Update, Delete
- Payment integration with Stripe
- Application submission tracking
- User and application management dashboard
- Analytics endpoints for Admins
- Secure REST APIs

---

## Tech Stack

- **Runtime:** Node.js  
- **Framework:** Express.js  
- **Database:** MongoDB  
- **Authentication:** Firebase Auth   
- **Payment:** Stripe Checkout  
- **Hosting:** Vercel (Serverless Functions)  

---
