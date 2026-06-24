import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  const isAdminRoute = pathname.startsWith("/admin");
  const isSellerRoute = pathname.startsWith("/seller");
  const isDashboard = isAdminRoute || isSellerRoute;

  if (isAuthPage && isLoggedIn) {
    const redirectUrl = role === "SUPER_ADMIN" ? "/admin" : "/seller";
    return Response.redirect(new URL(redirectUrl, req.url));
  }

  if (isDashboard && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.url));
  }

  if (isAdminRoute && role !== "SUPER_ADMIN") {
    return Response.redirect(new URL("/seller", req.url));
  }

  if (isSellerRoute && role === "SUPER_ADMIN") {
    return Response.redirect(new URL("/admin", req.url));
  }
});

export const config = {
  matcher: ["/admin/:path*", "/seller/:path*", "/login", "/forgot-password", "/reset-password"],
};
