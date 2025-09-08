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

    // Генерируем magic link
    const finalRedirectUrl = 'https://paneldoirp.vercel.app/auth/callback'
    
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!,
      options: {
        redirectTo: finalRedirectUrl
      }
    })

    if (error) {
      console.error('❌ Error generating magic link:', error)
      throw new Error(`Failed to generate magic link: ${error.message}`)
    }

    console.log('✅ Magic link generated for:', user.email)
    console.log('🔗 Action link:', data.properties?.action_link?.substring(0, 50) + '...')

    // Перенаправляем на magic link
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': data.properties?.action_link || finalRedirectUrl
      }
    })

  } catch (error) {
    console.error('❌ Error in auth-by-qr-token:', error)
    
    // Перенаправляем на главную с ошибкой
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': 'https://paneldoirp.vercel.app/?error=' + encodeURIComponent(error.message)
      }
    })
  }
})
