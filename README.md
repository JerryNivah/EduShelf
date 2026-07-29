# 📚 EduShelf

EduShelf is a modern full-stack bookstore management system built as a software engineering portfolio project.

The platform enables customers to browse educational books, manage shopping carts and wishlists, place orders, and pay using Safaricom M-Pesa. Administrators can manage books, categories, educational levels, inventory, orders, and payments through an administrative dashboard.

The project follows a modern serverless architecture using React, Prisma, PostgreSQL, and Vercel.

---

# Features

## Customer Features

- Browse available books
- Search and filter books
- View book details
- Shopping cart
- Wishlist
- Book reviews and ratings
- User authentication
- Checkout
- M-Pesa payment integration

## Administrator Features

- Manage books
- Manage categories
- Manage education levels
- Manage inventory
- Manage customer orders
- Monitor payments

---

# Tech Stack

## Frontend

- React 19
- Vite
- Tailwind CSS v4
- React Router
- Zustand
- TanStack Query
- React Hook Form
- Zod
- Axios
- Framer Motion

## Backend

- Vercel Serverless Functions
- Node.js
- Prisma ORM

## Database

- PostgreSQL
- Neon Database

## Authentication

- JWT Authentication
- Google OAuth
- bcrypt Password Hashing

## Payments

- Safaricom M-Pesa Sandbox (Daraja API)

## Storage

- Cloudinary

---

# Database Design

The database has been designed using Prisma ORM and PostgreSQL.

Core entities include:

- User
- Book
- BookImage
- Category
- Level
- Review
- Cart
- CartItem
- Wishlist
- WishlistItem
- Order
- OrderItem
- Payment

---

# Project Structure

```
EduShelf
│
├── api/                 # Vercel Serverless Functions
├── client/              # React Frontend
├── lib/                 # Shared utilities
├── prisma/              # Prisma schema & migrations
├── public/
└── README.md
```

---

# Getting Started

## Prerequisites

- Node.js 22+
- npm
- PostgreSQL (or Neon)
- Git

---

## Installation

Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/EduShelf.git
```

Move into the project

```bash
cd EduShelf
```

Install dependencies

```bash
npm install
npm --prefix client install
```

Create your environment file

```bash
cp .env.example .env
```

Generate Prisma Client

```bash
npm run prisma:generate
```

Run the development server

```bash
npm run dev
```

---

# Environment Variables

The project uses:

```
DATABASE_URL=
DIRECT_URL=

JWT_SECRET=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
```

---

# Current Progress

- ✅ Project Foundation
- ✅ Database Design
- ⏳ Backend API Development
- ⏳ Authentication
- ⏳ Shopping Cart Logic
- ⏳ Order Processing
- ⏳ M-Pesa Integration
- ⏳ Admin Dashboard
- ⏳ Deployment

---

# Future Improvements

- Email notifications
- Inventory analytics
- Book recommendations
- Sales reports
- PDF invoices
- Docker deployment
- CI/CD pipeline

---

# License

This project is licensed under the MIT License.

---

# Author

Developed by **Jerry Niva** as a portfolio software engineering project.