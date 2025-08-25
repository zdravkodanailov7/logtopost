# LogToPost

Transform your daily work logs into engaging X posts with AI-powered content generation.

## 📖 About

LogToPost is a web application that helps professionals turn their daily work activities into compelling X content. Simply log your work, and let AI transform it into professional posts that showcase your expertise and achievements.

**Read the full story and technical deep-dive**: [zdravkodanailov.com/blog/logtopost](https://zdravkodanailov.com/blog/logtopost)

## ✨ Features

- **AI-Powered Content Generation**: Transform work logs into engaging X posts
- **Custom AI Prompts**: Personalize the tone and style of generated content  
- **Daily Log Management**: Track and organize your work activities
- **Stripe Integration**: Secure subscription management
- **Real-time Billing**: Live subscription status without webhook delays
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS

## 🛠 Tech Stack

**Frontend:**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion
- Radix UI Components

**Backend:**
- Express.js
- TypeScript  
- Drizzle ORM
- PostgreSQL
- JWT Authentication

**Integrations:**
- OpenAI API (GPT-4)
- Stripe (Payments & Billing)

## 📁 Project Structure

```
logtopost/
├── frontend/           # Next.js frontend application
│   ├── app/           # App router pages
│   ├── components/    # Reusable UI components  
│   ├── contexts/      # React contexts
│   ├── hooks/         # Custom React hooks
│   └── lib/           # Utility functions
├── backend/           # Express.js backend API
│   ├── routes/        # API route handlers
│   ├── schema/        # Database schema
│   ├── utils/         # Backend utilities
│   ├── middleware/    # Express middleware
│   └── drizzle/       # Database migrations
└── README.md
```

## 🔗 Learn More

For a detailed walkthrough of the development process, architecture decisions, and lessons learned, check out the blog post: **[zdravkodanailov.com/blog/logtopost](https://zdravkodanailov.com/blog/logtopost)**

---

Built with ❤️ by [Zdravko Danailov](https://zdravkodanailov.com)
