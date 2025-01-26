# Film Fanatic 🎬

A modern and sleek web application built with **Next.js** for exploring movies and TV shows, powered by the **TMDB API**. Dive into the world of cinema with a seamless and visually stunning experience.

---

## Features ✨

### 🎥 **Content Discovery**

- **Browse** popular movies and TV shows
- **Advanced search** functionality with filters
- **Personalized recommendations** based on your preferences

### 📄 **Detailed Information**

- **Cast and crew details** for every movie and show
- **Trailers and videos** to get a sneak peek
- **High-quality image galleries** for posters and stills
- **Release information** including dates and regions
- **Ratings and reviews** from critics and audiences

### 👤 **User Features**

- **Customizable watchlist** to save your favorites
- **Dark/Light theme support** for comfortable viewing
- **Fully responsive design** for all devices

---

## Tech Stack 🛠️

### Frontend

- **Framework**: Next.js 15.1.4
- **Language**: TypeScript

### Styling

- Tailwind CSS
- `tailwind-merge`
- `class-variance-authority`

### UI Components

- Radix UI
- Lucide Icons

### State Management

- Zustand
- `@tanstack/react-query`

### Database

- Turso via `@libsql/client`

### Development Tools

- ESLint
- Prettier

---

## Getting Started 🚀

### Prerequisites

- Node.js 18.17.0 or higher
- PNPM package manager
- TMDB API key
- Turso database

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Swastikdan/Film-Fanatic.git
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Configure environment variables:
   - Create a `.env.local` file and add your TMDB API key and Turso database credentials.
4. Start the development server:
   ```bash
   pnpm dev
   ```
5. Open `http://localhost:3000` in your browser.

### Available Scripts

| Command             | Description                  |
| ------------------- | ---------------------------- |
| `pnpm dev`          | Start development server     |
| `pnpm build`        | Build production bundle      |
| `pnpm start`        | Start production server      |
| `pnpm lint`         | Run ESLint                   |
| `pnpm format:check` | Check code formatting        |
| `pnpm format:write` | Fix code formatting          |
| `pnpm typecheck`    | Run TypeScript type checking |

---

## Contributing 🤝

We welcome contributions from the community! Here’s how you can help:

1. **Fork** the repository.
2. Create a **feature branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit** your changes:
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. **Push** to the branch:
   ```bash
   git push origin feature/amazing-feature
   ```
5. Open a **Pull Request**.

---

## License 📝

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments 🙏

- **[The Movie Database (TMDB)](https://www.themoviedb.org/)** for providing the comprehensive movie and TV show API.
- The amazing open-source community for providing excellent libraries and tools:
  - [Next.js](https://nextjs.org/)
  - [Radix UI](https://www.radix-ui.com/)
  - [TanStack Query](https://tanstack.com/query/)
  - [Tailwind CSS](https://tailwindcss.com/)
  - [Turso](https://turso.tech/)
- All contributors who have helped improve this project.

---

## Project Links 🔗

### Live Environments

- **Production**: [https://film-fanatic.vercel.app](https://film-fanatic.vercel.app)
- **Development**: [GitHub Repository](https://github.com/Swastikdan/Film-Fanatic)

### Quick Links

- [Report Bug](https://github.com/Swastikdan/Film-Fanatic/issues)
- [Request Feature](https://github.com/Swastikdan/Film-Fanatic/issues)
- [Project Roadmap](https://github.com/Swastikdan/Film-Fanatic/projects)
- [Documentation](https://github.com/Swastikdan/Film-Fanatic/wiki)

---

## Author ✨

**Swastik Dan**

- GitHub: [@Swastikdan](https://github.com/Swastikdan)
- Portfolio: [swastikdan.com](https://swastikdan.com)

---

<div align="center">

[![Made with Next.js](https://img.shields.io/badge/Made%20with-Next.js-000000?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Powered by TMDB](https://img.shields.io/badge/Powered%20by-TMDB-01B4E4?style=for-the-badge&logo=themoviedatabase)](https://www.themoviedb.org)

Made with ❤️ by [Swastik Dan](https://github.com/Swastikdan)

</div>
