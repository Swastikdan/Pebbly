import type { Metadata } from 'next'
import { Parkinsans } from 'next/font/google'
import './globals.css'

const parkinsans = Parkinsans({
  variable: '--font-parkinsans',
  subsets: ['latin'],
  weight: 'variable',
  fallback: ['sans-serif'],
  display: 'swap',
})
import { Providers } from './Providers'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Film Fanatic',
  description:
    'Explore a vast collection of movies and TV shows with Film Fanatic.',
  applicationName: 'Film Fanatic',
  keywords: [
    'movie database',
    'film reviews',
    'TV show information',
    'movie ratings',
    'entertainment',
  ],
  robots: 'noindex, nofollow',
  icons: [
    {
      url: '/logo.svg',
      sizes: 'any',
      type: 'image/x-icon',
    },
    {
      url: 'https://ik.imagekit.io/swastikdan/Film-Fanatic/public/apple-touch-icon.png',
      sizes: '180x180',
      type: 'image/png',
    },
    {
      url: 'https://ik.imagekit.io/swastikdan/Film-Fanatic/public/favicon-32x32.png',
      sizes: '32x32',
      type: 'image/png',
    },
    {
      url: 'https://ik.imagekit.io/swastikdan/Film-Fanatic/public/favicon-16x16.png',
      sizes: '16x16',
      type: 'image/png',
    },
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Film Fanatic',
    images: [
      {
        url: 'https://ik.imagekit.io/swastikdan/Film-Fanatic/public/ogimage.webp?updatedAt=1715421360221',
        width: 1200,
        height: 630,
        alt: 'Film Fanatic',
      },
    ],
  },
  twitter: {
    site: '@swastikdan',
    card: 'summary_large_image',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <noscript>
          {/* <style>
            {`
              body {
              overflow: hidden;
              }
              .noscript-warning {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                max-width: 600px;
                width: 90%;
                padding: 2rem;
                background-color: #fee2e2;
                border-radius: 8px;
                box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
                text-align: center;
                z-index: 9999;
                font-family: system-ui, -apple-system, sans-serif;
                animation: float 3s ease-in-out infinite;
               
              }
              @keyframes float {
                0% { transform: translate(-50%, -50%); }
                50% { transform: translate(-50%, -52%); }
                100% { transform: translate(-50%, -50%); }
              }
              .noscript-warning h1 {
                color: #991b1b;
                font-size: 2rem;
                margin-bottom: 1rem;
                font-weight: 600;
              }
              .noscript-warning p {
                color: #450a0a;
                margin: 0.75rem 0;
                line-height: 1.6;
              }
            `}
          </style> */}
          <div className="noscript-warning" role="alert">
            <h1>JavaScript is Required</h1>
            <p>
              Film Fanatic requires JavaScript to provide you with the best
              movie browsing experience. Please enable JavaScript in your
              browser settings and reload the page.
            </p>
            <p>
              <strong>How to enable JavaScript:</strong> Go to your browser
              settings, find the JavaScript or content settings section, and
              make sure JavaScript is allowed.
            </p>
          </div>
        </noscript>
      </head>
      <body
        className={`${parkinsans.variable} font-parkinsans leading-relaxed antialiased`}
      >
        <Providers>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
