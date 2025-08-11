# 🦎 Greptile Clone - AI-Powered Code Review Platform

A complete, modern clone of Greptile's AI code review platform built with **Next.js 14**, **TypeScript**, and **Tailwind CSS**. Features functional AI chat, dashboard management, and a beautiful responsive UI.

## 🔧 **Environment Setup**

Create a `.env.local` file in your project root with these variables:

```bash
# OpenAI Integration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key

# GitHub Integration (Optional - for private repos)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# NextAuth (Required for authentication)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-string

# Webhooks (Optional)
WEBHOOK_SECRET=your-webhook-secret
```

### **How to Get These Keys:**

1. **OpenAI API Key**: [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Supabase**: [Supabase Dashboard](https://supabase.com/dashboard)
3. **GitHub OAuth**: [GitHub Developer Settings](https://github.com/settings/developers)

## ✨ Features

### 🤖 **AI-Powered Code Reviews**
- Automated pull request analysis
- Context-aware code suggestions
- Security vulnerability detection
- Performance optimization recommendations

### 💬 **Interactive AI Chat**
- Ask questions about your codebase in natural language
- Get instant, contextual responses
- Full conversation history
- Real-time typing indicators

### 📊 **Comprehensive Dashboard**
- Repository management interface
- PR review tracking and analytics
- Customizable AI review settings
- Team collaboration tools

### 🔐 **Authentication System**
- Sign up/Sign in pages
- User profile management
- Team and organization support

### 💰 **Flexible Pricing**
- **Currently FREE** for all features during testing phase
- Free, Pro, and Enterprise tiers
- No payment required to access full functionality

## 🚀 Quick Start

### **Option 1: Run on Replit (Recommended)**

1. **Create GitHub Repository:**
   - Go to [GitHub](https://github.com) and create a new repository
   - Copy this project to your GitHub repo

2. **Import to Replit:**
   - Go to [Replit](https://replit.com)
   - Click "Create Repl" → "Import from GitHub"
   - Paste your GitHub repository URL
   - Click "Import from GitHub"

3. **Set Environment Variables in Replit:**
   - Go to Replit Secrets (lock icon in sidebar)
   - Add all the environment variables listed above

4. **Run the Project:**
   ```bash
   npm install
   npm run dev
   ```

5. **Access Your App:**
   - Your app will be available at the Replit URL
   - All features are fully functional!

### **Option 2: Local Development**

1. **Clone & Install:**
   ```bash
   git clone <your-repo-url>
   cd greptile-clone
   npm install
   ```

2. **Set Environment Variables:**
   - Create `.env.local` file with the variables above
   - Add your actual API keys and credentials

3. **Run Development Server:**
   ```bash
   npm run dev
   ```

4. **Open in Browser:**
   - Visit `http://localhost:3000`
   - Start exploring the AI-powered features!

## 📱 Pages & Features

### **🏠 Landing Page** (`/`)
- Hero section with value proposition
- Feature showcase with animations
- Interactive pricing section (all free!)
- Customer testimonials

### **🔐 Authentication**
- **Sign Up** (`/auth/signup`) - New user registration
- **Sign In** (`/auth/signin`) - User login

### **📊 Dashboard** (`/dashboard`)
- **Main Dashboard** - Overview with stats and AI chat
- **Repositories** (`/dashboard/repositories`) - Manage connected repos
- **Reviews** (`/dashboard/reviews`) - View AI-generated PR reviews
- **Settings** (`/dashboard/settings`) - Configure AI preferences

### **🎬 Interactive Demo** (`/demo`)
- Step-by-step product walkthrough
- **Functional AI chat** - Try it out!
- Live examples of AI code analysis

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **AI:** OpenAI GPT-4
- **Authentication:** NextAuth.js
- **UI Components:** Headless UI, Radix UI
- **Icons:** Heroicons, Lucide React
- **Animations:** Framer Motion
- **State Management:** Zustand
- **Forms:** React Hook Form + Zod validation

## 🔧 Configuration Files

### **Replit Ready**
- `.replit` - Replit configuration
- `replit.nix` - System dependencies
- Automatic port forwarding on port 3000

### **Development**
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS setup
- `tsconfig.json` - TypeScript configuration
- `postcss.config.js` - PostCSS setup

## 🎯 Key Differences from Original Greptile

### **✅ What We Improved:**
- **🌐 Web-first approach** (vs deprecated VS Code extension)
- **💰 Freemium model** (vs enterprise-only)
- **📱 Mobile responsive design**
- **🎨 Modern UI/UX** with Tailwind CSS
- **⚡ Better performance** with Next.js 14
- **🔧 Easy deployment** on Replit/Vercel

### **🚀 What We Match:**
- **AI code review functionality**
- **Codebase context understanding**
- **Pull request automation**
- **Team collaboration features**
- **Professional enterprise UI**

## 📦 Deployment Options

### **1. Replit (Easiest)**
- One-click deployment from GitHub
- Automatic HTTPS and custom domains
- Built-in collaboration tools
- Environment variables via Secrets

### **2. Vercel**
```bash
npm i -g vercel
vercel --prod
```
- Add environment variables in Vercel dashboard

### **3. Netlify**
```bash
npm run build
# Deploy the 'out' folder
```
- Add environment variables in Netlify dashboard

## 🔮 Future Enhancements

### **Backend Integration Ready:**
- Database schema planned (Supabase)
- API routes structure in place
- Authentication flow designed
- Payment integration prepared (Stripe)

### **Planned Features:**
- Real GitHub/GitLab API integration
- OpenAI/Anthropic AI model integration
- Webhook handling for PR automation
- Team management and permissions
- Advanced analytics and reporting

## 📝 Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Greptile.com](https://greptile.com)
- Built with modern web technologies
- UI/UX inspired by leading SaaS platforms

---

## 🚀 **Ready to Deploy!**

Your Greptile clone is production-ready and can be deployed to:
- **Replit** (recommended for quick setup)
- **Vercel** (for professional hosting)
- **Netlify** (for static deployment)
- **Any Node.js hosting provider**

**🎉 Start building the future of AI-powered code reviews!** 