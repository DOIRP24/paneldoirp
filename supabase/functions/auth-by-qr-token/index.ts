import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 auth-by-qr-token Edge Function called')
    console.log('📋 Request method:', req.method)
    console.log('📋 Request URL:', req.url)
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing environment variables')
      throw new Error('Missing Supabase configuration')
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Получаем токен из body (POST) или URL path (GET)
    let token: string;
    
    if (req.method === 'POST') {
      const body = await req.json()
      token = body.token
    } else {
      // GET запрос - токен из URL path
      const url = new URL(req.url)
      const pathParts = url.pathname.split('/')
      token = pathParts[pathParts.length - 1] // последняя часть пути
    }
    
    if (!token || token === 'auth-by-qr-token') {
      console.error('❌ No token provided. URL:', req.url)
      throw new Error('Token is required')
    }

    console.log('🔍 Looking up QR token:', token.substring(0, 8) + '...')

    // Находим активный токен
    const { data: qrToken, error: tokenError } = await supabaseAdmin
      .from('user_qr_tokens')
      .select('user_id')
      .eq('token', token)
      .eq('is_active', true)
      .single()

    if (tokenError || !qrToken) {
      console.error('❌ Invalid or expired token:', tokenError)
      throw new Error('Invalid or expired QR token')
    }

    console.log('✅ Valid token found for user:', qrToken.user_id)

    // Получаем пользователя
    const { data: usersList, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    if (usersError) {
      console.error('❌ Error listing users:', usersError)
      throw new Error('Failed to list users')
    }

    const user = usersList.users.find(u => u.id === qrToken.user_id)
    if (!user) {
      throw new Error('User not found')
    }

    console.log('✅ User found:', user.email)

    // Создаем сессию напрямую для пользователя
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!,
      options: {
        redirectTo: 'https://paneldoirp.vercel.app/auth/qr/success'
      }
    })

    if (sessionError) {
      console.error('❌ Error generating session:', sessionError)
      throw new Error(`Failed to generate session: ${sessionError.message}`)
    }

    console.log('✅ Session generated for:', user.email)

    // Извлекаем токены из magic link
    const magicLinkUrl = sessionData.properties?.action_link
    if (!magicLinkUrl) {
      throw new Error('No magic link generated')
    }

    // Парсим URL для извлечения токенов
    const url = new URL(magicLinkUrl)
    const accessToken = url.searchParams.get('access_token') || url.hash.match(/access_token=([^&]+)/)?.[1]
    const refreshToken = url.searchParams.get('refresh_token') || url.hash.match(/refresh_token=([^&]+)/)?.[1]

    if (!accessToken || !refreshToken) {
      // Если токенов нет в URL, возвращаем magic link для активации
      return new Response(JSON.stringify({
        success: true,
        redirectUrl: magicLinkUrl,
        needsActivation: true
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      })
    }

    // Возвращаем токены напрямую
    return new Response(JSON.stringify({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('❌ Error in auth-by-qr-token:', error)
    
    // Возвращаем ошибку в JSON
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Authentication failed'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }
})
