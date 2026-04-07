import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/unauthorized']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Admin/superadmin → tüm sayfalara erişim
  if (profile && ['admin', 'superadmin'].includes(profile.role)) {
    return supabaseResponse
  }

  // IB kullanıcısı kontrolü
  try {
    const { data: ibProfile } = await adminClient
      .from('ib_profiles')
      .select('id')
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (ibProfile) {
      if (pathname === '/dashboard/ib/portal') return supabaseResponse
      return NextResponse.redirect(new URL('/dashboard/ib/portal', request.url))
    }
  } catch (_) { }

  // Staff kullanıcısı kontrolü (user_roles kaydı olanlar)
  try {
    const { data: staffRoles } = await adminClient
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .limit(1)

    if (staffRoles && staffRoles.length > 0) {
      return supabaseResponse // Sayfa bazlı izin kontrolü yapılacak
    }
  } catch (_) { }

  return NextResponse.redirect(new URL('/unauthorized', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
