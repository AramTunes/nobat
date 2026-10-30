import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "نوبتک — رزرو نوبت" },
      { name: "description", content: "رزرو نوبت برای آرایشگاه، درمان، مشاوره و هر کسب‌وکاری که وقتش مهم است." },
      { name: "theme-color", content: "#0e6b54" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="fa" dir="rtl" className="antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var s=localStorage.getItem("nobat.theme");var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){}})();',
          }}
        />
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <ThemeProvider>
          <AuthProvider>
            <SessionProvider>
              <Outlet />
              <Toaster
              position="top-center"
              dir="rtl"
              toastOptions={{
                style: {
                  background: "var(--color-card)",
                  color: "var(--color-ink)",
                  border: "1px solid var(--color-line)",
                  fontFamily: "inherit",
                },
              }}
              />
            </SessionProvider>
          </AuthProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  ),
});
